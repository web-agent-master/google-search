import { chromium, devices, BrowserContextOptions, Browser } from "playwright";
import { SearchResponse, SearchResult, CommandOptions, HtmlResponse } from "./types.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import logger from "./logger.js";
import { url } from "inspector";

// 指纹配置接口
interface FingerprintConfig {
  deviceName: string;
  locale: string;
  timezoneId: string;
  colorScheme: "dark" | "light";
  reducedMotion: "reduce" | "no-preference";
  forcedColors: "active" | "none";
}

// 保存的状态文件接口
interface SavedState {
  fingerprint?: FingerprintConfig;
  googleDomain?: string;
}

/**
 * 获取宿主机器的实际配置
 * @param userLocale 用户指定的区域设置（如果有）
 * @returns 基于宿主机器的指纹配置
 */
function getHostMachineConfig(userLocale?: string): FingerprintConfig {
  // 获取系统区域设置
  const systemLocale = userLocale || process.env.LANG || "zh-CN";

  // 获取系统时区
  // Node.js 不直接提供时区信息，但可以通过时区偏移量推断
  const timezoneOffset = new Date().getTimezoneOffset();
  let timezoneId = "Asia/Shanghai"; // 默认使用上海时区

  // 根据时区偏移量粗略推断时区
  // 时区偏移量是以分钟为单位，与UTC的差值，负值表示东区
  if (timezoneOffset <= -480 && timezoneOffset > -600) {
    // UTC+8 (中国、新加坡、香港等)
    timezoneId = "Asia/Shanghai";
  } else if (timezoneOffset <= -540) {
    // UTC+9 (日本、韩国等)
    timezoneId = "Asia/Tokyo";
  } else if (timezoneOffset <= -420 && timezoneOffset > -480) {
    // UTC+7 (泰国、越南等)
    timezoneId = "Asia/Bangkok";
  } else if (timezoneOffset <= 0 && timezoneOffset > -60) {
    // UTC+0 (英国等)
    timezoneId = "Europe/London";
  } else if (timezoneOffset <= 60 && timezoneOffset > 0) {
    // UTC-1 (欧洲部分地区)
    timezoneId = "Europe/Berlin";
  } else if (timezoneOffset <= 300 && timezoneOffset > 240) {
    // UTC-5 (美国东部)
    timezoneId = "America/New_York";
  }

  // 检测系统颜色方案
  // Node.js 无法直接获取系统颜色方案，使用合理的默认值
  // 可以根据时间推断：晚上使用深色模式，白天使用浅色模式
  const hour = new Date().getHours();
  const colorScheme =
    hour >= 19 || hour < 7 ? ("dark" as const) : ("light" as const);

  // 其他设置使用合理的默认值
  const reducedMotion = "no-preference" as const; // 大多数用户不会启用减少动画
  const forcedColors = "none" as const; // 大多数用户不会启用强制颜色

  // 选择一个合适的设备名称
  // 根据操作系统选择合适的浏览器
  const platform = os.platform();
  let deviceName = "Desktop Chrome"; // 默认使用Chrome

  if (platform === "darwin") {
    // macOS
    deviceName = "Desktop Safari";
  } else if (platform === "win32") {
    // Windows
    deviceName = "Desktop Edge";
  } else if (platform === "linux") {
    // Linux
    deviceName = "Desktop Firefox";
  }

  // 我们使用的Chrome
  deviceName = "Desktop Chrome";

  return {
    deviceName,
    locale: systemLocale,
    timezoneId,
    colorScheme,
    reducedMotion,
    forcedColors,
  };
}

/**
 * 执行Google搜索并返回结果
 * @param query 搜索关键词
 * @param options 搜索选项
 * @returns 搜索结果
 */
export async function googleSearch(
  query: string,
  options: CommandOptions = {},
  existingBrowser?: Browser
): Promise<SearchResponse> {
  // 设置默认选项
  const {
    limit = 10,
    timeout = 60000,
    stateFile = "./browser-state.json",
    noSaveState = false,
    locale = "zh-CN", // 默认使用中文
  } = options;

  // 忽略传入的headless参数，总是以无头模式启动
  let useHeadless = true;

  logger.info({ options }, "正在初始化浏览器...");

  // 检查是否存在状态文件
  let storageState: string | undefined = undefined;
  let savedState: SavedState = {};

  // 指纹配置文件路径
  const fingerprintFile = stateFile.replace(".json", "-fingerprint.json");

  if (fs.existsSync(stateFile)) {
    logger.info(
      { stateFile },
      "发现浏览器状态文件，将使用保存的浏览器状态以避免反机器人检测"
    );
    storageState = stateFile;

    // 尝试加载保存的指纹配置
    if (fs.existsSync(fingerprintFile)) {
      try {
        const fingerprintData = fs.readFileSync(fingerprintFile, "utf8");
        savedState = JSON.parse(fingerprintData);
        logger.info("已加载保存的浏览器指纹配置");
      } catch (e) {
        logger.warn({ error: e }, "无法加载指纹配置文件，将创建新的指纹");
      }
    }
  } else {
    logger.info(
      { stateFile },
      "未找到浏览器状态文件，将创建新的浏览器会话和指纹"
    );
  }

  // 只使用桌面设备列表
  const deviceList = [
    "Desktop Chrome",
    "Desktop Edge",
    "Desktop Firefox",
    "Desktop Safari",
  ];

  // 时区列表
  const timezoneList = [
    "America/New_York",
    "Europe/London",
    "Asia/Shanghai",
    "Europe/Berlin",
    "Asia/Tokyo",
  ];

  // Google域名列表
  const googleDomains = [
    "https://www.google.com",
    "https://www.google.co.uk",
    "https://www.google.ca",
    "https://www.google.com.au",
  ];

  // 获取随机设备配置或使用保存的配置
  const getDeviceConfig = (): [string, any] => {
    if (
      savedState.fingerprint?.deviceName &&
      devices[savedState.fingerprint.deviceName]
    ) {
      // 使用保存的设备配置
      return [
        savedState.fingerprint.deviceName,
        devices[savedState.fingerprint.deviceName],
      ];
    } else {
      // 随机选择一个设备
      const randomDevice =
        deviceList[Math.floor(Math.random() * deviceList.length)];
      return [randomDevice, devices[randomDevice]];
    }
  };

  // 获取随机延迟时间
  const getRandomDelay = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  // 定义一个函数来执行搜索，可以重用于无头和有头模式
  async function performSearch(headless: boolean): Promise<SearchResponse> {
    let browser: Browser;
    let browserWasProvided = false;

    if (existingBrowser) {
      browser = existingBrowser;
      browserWasProvided = true;
      logger.info("使用已存在的浏览器实例");
    } else {
      logger.info(
        { headless },
        `准备以${headless ? "无头" : "有头"}模式启动浏览器...`
      );

      // 初始化浏览器，添加更多参数以避免检测
      browser = await chromium.launch({
        headless,
        timeout: timeout * 2, // 增加浏览器启动超时时间
        args: [
          "--disable-blink-features=AutomationControlled",
          "--disable-features=IsolateOrigins,site-per-process",
          "--disable-site-isolation-trials",
          "--disable-web-security",
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
          "--hide-scrollbars",
          "--mute-audio",
          "--disable-background-networking",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-breakpad",
          "--disable-component-extensions-with-background-pages",
          "--disable-extensions",
          "--disable-features=TranslateUI",
          "--disable-ipc-flooding-protection",
          "--disable-renderer-backgrounding",
          "--enable-features=NetworkService,NetworkServiceInProcess",
          "--force-color-profile=srgb",
          "--metrics-recording-only",
        ],
        ignoreDefaultArgs: ["--enable-automation"],
      });

      logger.info("浏览器已成功启动!");
    }

    // 获取设备配置 - 使用保存的或随机生成
    const [deviceName, deviceConfig] = getDeviceConfig();

    // 创建浏览器上下文选项
    let contextOptions: BrowserContextOptions = {
      ...deviceConfig,
    };

    // 如果有保存的指纹配置，使用它；否则使用宿主机器的实际设置
    if (savedState.fingerprint) {
      contextOptions = {
        ...contextOptions,
        locale: savedState.fingerprint.locale,
        timezoneId: savedState.fingerprint.timezoneId,
        colorScheme: savedState.fingerprint.colorScheme,
        reducedMotion: savedState.fingerprint.reducedMotion,
        forcedColors: savedState.fingerprint.forcedColors,
      };
      logger.info("使用保存的浏览器指纹配置");
    } else {
      // 获取宿主机器的实际设置
      const hostConfig = getHostMachineConfig(locale);

      // 如果需要使用不同的设备类型，重新获取设备配置
      if (hostConfig.deviceName !== deviceName) {
        logger.info(
          { deviceType: hostConfig.deviceName },
          "根据宿主机器设置使用设备类型"
        );
        // 使用新的设备配置
        contextOptions = { ...devices[hostConfig.deviceName] };
      }

      contextOptions = {
        ...contextOptions,
        locale: hostConfig.locale,
        timezoneId: hostConfig.timezoneId,
        colorScheme: hostConfig.colorScheme,
        reducedMotion: hostConfig.reducedMotion,
        forcedColors: hostConfig.forcedColors,
      };

      // 保存新生成的指纹配置
      savedState.fingerprint = hostConfig;
      logger.info(
        {
          locale: hostConfig.locale,
          timezone: hostConfig.timezoneId,
          colorScheme: hostConfig.colorScheme,
          deviceType: hostConfig.deviceName,
        },
        "已根据宿主机器生成新的浏览器指纹配置"
      );
    }

    // 添加通用选项 - 确保使用桌面配置
    contextOptions = {
      ...contextOptions,
      permissions: ["geolocation", "notifications"],
      acceptDownloads: true,
      isMobile: false, // 强制使用桌面模式
      hasTouch: false, // 禁用触摸功能
      javaScriptEnabled: true,
    };

    if (storageState) {
      logger.info("正在加载保存的浏览器状态...");
    }

    const context = await browser.newContext(
      storageState ? { ...contextOptions, storageState } : contextOptions
    );

    // 设置额外的浏览器属性以避免检测
    await context.addInitScript(() => {
      // 覆盖 navigator 属性
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5],
      });
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en", "zh-CN"],
      });

      // 覆盖 window 属性
      // @ts-ignore - 忽略 chrome 属性不存在的错误
      window.chrome = {
        runtime: {},
        loadTimes: function () {},
        csi: function () {},
        app: {},
      };

      // 添加 WebGL 指纹随机化
      if (typeof WebGLRenderingContext !== "undefined") {
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function (
          parameter: number
        ) {
          // 随机化 UNMASKED_VENDOR_WEBGL 和 UNMASKED_RENDERER_WEBGL
          if (parameter === 37445) {
            return "Intel Inc.";
          }
          if (parameter === 37446) {
            return "Intel Iris OpenGL Engine";
          }
          return getParameter.call(this, parameter);
        };
      }
    });

    const page = await context.newPage();

    // 设置页面额外属性
    await page.addInitScript(() => {
      // 模拟真实的屏幕尺寸和颜色深度
      Object.defineProperty(window.screen, "width", { get: () => 1920 });
      Object.defineProperty(window.screen, "height", { get: () => 1080 });
      Object.defineProperty(window.screen, "colorDepth", { get: () => 24 });
      Object.defineProperty(window.screen, "pixelDepth", { get: () => 24 });
    });

    try {
      // 使用保存的Google域名或随机选择一个
      let selectedDomain: string;
      if (savedState.googleDomain) {
        selectedDomain = savedState.googleDomain;
        logger.info({ domain: selectedDomain }, "使用保存的Google域名");
      } else {
        selectedDomain =
          googleDomains[Math.floor(Math.random() * googleDomains.length)];
        // 保存选择的域名
        savedState.googleDomain = selectedDomain;
        logger.info({ domain: selectedDomain }, "随机选择Google域名");
      }

      logger.info("正在访问Google搜索页面...");

      // 访问Google搜索页面
      const response = await page.goto(selectedDomain, {
        timeout,
        waitUntil: "networkidle",
      });

      // 检查是否被重定向到人机验证页面
      const currentUrl = page.url();
      const sorryPatterns = [
        "google.com/sorry/index",
        "google.com/sorry",
        "recaptcha",
        "captcha",
        "unusual traffic",
      ];

      const isBlockedPage = sorryPatterns.some(
        (pattern) =>
          currentUrl.includes(pattern) ||
          (response && response.url().toString().includes(pattern))
      );

      if (isBlockedPage) {
        if (headless) {
          logger.warn("检测到人机验证页面，将以有头模式重新启动浏览器...");

          // 关闭当前页面和上下文
          await page.close();
          await context.close();

          // 如果是外部提供的浏览器，不关闭它，而是创建一个新的浏览器实例
          if (browserWasProvided) {
            logger.info(
              "使用外部浏览器实例时遇到人机验证，创建新的浏览器实例..."
            );
            // 创建一个新的浏览器实例，不再使用外部提供的实例
            const newBrowser = await chromium.launch({
              headless: false, // 使用有头模式
              timeout: timeout * 2,
              args: [
                "--disable-blink-features=AutomationControlled",
                // 其他参数与原来相同
                "--disable-features=IsolateOrigins,site-per-process",
                "--disable-site-isolation-trials",
                "--disable-web-security",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--no-first-run",
                "--no-zygote",
                "--disable-gpu",
                "--hide-scrollbars",
                "--mute-audio",
                "--disable-background-networking",
                "--disable-background-timer-throttling",
                "--disable-backgrounding-occluded-windows",
                "--disable-breakpad",
                "--disable-component-extensions-with-background-pages",
                "--disable-extensions",
                "--disable-features=TranslateUI",
                "--disable-ipc-flooding-protection",
                "--disable-renderer-backgrounding",
                "--enable-features=NetworkService,NetworkServiceInProcess",
                "--force-color-profile=srgb",
                "--metrics-recording-only",
              ],
              ignoreDefaultArgs: ["--enable-automation"],
            });

            // 使用新的浏览器实例执行搜索
            try {
              const tempContext = await newBrowser.newContext(contextOptions);
              const tempPage = await tempContext.newPage();

              // 这里可以添加处理人机验证的代码
              // ...

              // 完成后关闭临时浏览器
              await newBrowser.close();

              // 重新执行搜索
              return performSearch(false);
            } catch (error) {
              await newBrowser.close();
              throw error;
            }
          } else {
            // 如果不是外部提供的浏览器，直接关闭并重新执行搜索
            await browser.close();
            return performSearch(false); // 以有头模式重新执行搜索
          }
        } else {
          logger.warn("检测到人机验证页面，请在浏览器中完成验证...");
          // 等待用户完成验证并重定向回搜索页面
          await page.waitForNavigation({
            timeout: timeout * 2,
            url: (url) => {
              const urlStr = url.toString();
              return sorryPatterns.every(
                (pattern) => !urlStr.includes(pattern)
              );
            },
          });
          logger.info("人机验证已完成，继续搜索...");
        }
      }

      logger.info({ query }, "正在输入搜索关键词");

      // 等待搜索框出现 - 尝试多个可能的选择器
      const searchInputSelectors = [
        "textarea[name='q']",
        "input[name='q']",
        "textarea[title='Search']",
        "input[title='Search']",
        "textarea[aria-label='Search']",
        "input[aria-label='Search']",
        "textarea",
      ];

      let searchInput = null;
      for (const selector of searchInputSelectors) {
        searchInput = await page.$(selector);
        if (searchInput) {
          logger.info({ selector }, "找到搜索框");
          break;
        }
      }

      if (!searchInput) {
        logger.error("无法找到搜索框");
        throw new Error("无法找到搜索框");
      }

      // 直接点击搜索框，减少延迟
      await searchInput.click();

      // 直接输入整个查询字符串，而不是逐个字符输入
      await page.keyboard.type(query, { delay: getRandomDelay(10, 30) });

      // 减少按回车前的延迟
      await page.waitForTimeout(getRandomDelay(100, 300));
      await page.keyboard.press("Enter");

      logger.info("正在等待页面加载完成...");

      // 等待页面加载完成
      await page.waitForLoadState("networkidle", { timeout });

      // 检查搜索后的URL是否被重定向到人机验证页面
      const searchUrl = page.url();
      const isBlockedAfterSearch = sorryPatterns.some((pattern) =>
        searchUrl.includes(pattern)
      );

      if (isBlockedAfterSearch) {
        if (headless) {
          logger.warn(
            "搜索后检测到人机验证页面，将以有头模式重新启动浏览器..."
          );

          // 关闭当前页面和上下文
          await page.close();
          await context.close();

          // 如果是外部提供的浏览器，不关闭它，而是创建一个新的浏览器实例
          if (browserWasProvided) {
            logger.info(
              "使用外部浏览器实例时搜索后遇到人机验证，创建新的浏览器实例..."
            );
            // 创建一个新的浏览器实例，不再使用外部提供的实例
            const newBrowser = await chromium.launch({
              headless: false, // 使用有头模式
              timeout: timeout * 2,
              args: [
                "--disable-blink-features=AutomationControlled",
                // 其他参数与原来相同
                "--disable-features=IsolateOrigins,site-per-process",
                "--disable-site-isolation-trials",
                "--disable-web-security",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--no-first-run",
                "--no-zygote",
                "--disable-gpu",
                "--hide-scrollbars",
                "--mute-audio",
                "--disable-background-networking",
                "--disable-background-timer-throttling",
                "--disable-backgrounding-occluded-windows",
                "--disable-breakpad",
                "--disable-component-extensions-with-background-pages",
                "--disable-extensions",
                "--disable-features=TranslateUI",
                "--disable-ipc-flooding-protection",
                "--disable-renderer-backgrounding",
                "--enable-features=NetworkService,NetworkServiceInProcess",
                "--force-color-profile=srgb",
                "--metrics-recording-only",
              ],
              ignoreDefaultArgs: ["--enable-automation"],
            });

            // 使用新的浏览器实例执行搜索
            try {
              const tempContext = await newBrowser.newContext(contextOptions);
              const tempPage = await tempContext.newPage();

              // 这里可以添加处理人机验证的代码
              // ...

              // 完成后关闭临时浏览器
              await newBrowser.close();

              // 重新执行搜索
              return performSearch(false);
            } catch (error) {
              await newBrowser.close();
              throw error;
            }
          } else {
            // 如果不是外部提供的浏览器，直接关闭并重新执行搜索
            await browser.close();
            return performSearch(false); // 以有头模式重新执行搜索
          }
        } else {
          logger.warn("搜索后检测到人机验证页面，请在浏览器中完成验证...");
          // 等待用户完成验证并重定向回搜索页面
          await page.waitForNavigation({
            timeout: timeout * 2,
            url: (url) => {
              const urlStr = url.toString();
              return sorryPatterns.every(
                (pattern) => !urlStr.includes(pattern)
              );
            },
          });
          logger.info("人机验证已完成，继续搜索...");

          // 等待页面重新加载
          await page.waitForLoadState("networkidle", { timeout });
        }
      }

      logger.info({ url: page.url() }, "正在等待搜索结果加载...");

      // 尝试多个可能的搜索结果选择器
      const searchResultSelectors = [
        "#search",
        "#rso",
        ".g",
        "[data-sokoban-container]",
        "div[role='main']",
      ];

      let resultsFound = false;
      for (const selector of searchResultSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: timeout / 2 });
          logger.info({ selector }, "找到搜索结果");
          resultsFound = true;
          break;
        } catch (e) {
          // 继续尝试下一个选择器
        }
      }

      if (!resultsFound) {
        // 如果找不到搜索结果，检查是否被重定向到人机验证页面
        const currentUrl = page.url();
        const isBlockedDuringResults = sorryPatterns.some((pattern) =>
          currentUrl.includes(pattern)
        );

        if (isBlockedDuringResults) {
          if (headless) {
            logger.warn(
              "等待搜索结果时检测到人机验证页面，将以有头模式重新启动浏览器..."
            );

            // 关闭当前页面和上下文
            await page.close();
            await context.close();

            // 如果是外部提供的浏览器，不关闭它，而是创建一个新的浏览器实例
            if (browserWasProvided) {
              logger.info(
                "使用外部浏览器实例时等待搜索结果遇到人机验证，创建新的浏览器实例..."
              );
              // 创建一个新的浏览器实例，不再使用外部提供的实例
              const newBrowser = await chromium.launch({
                headless: false, // 使用有头模式
                timeout: timeout * 2,
                args: [
                  "--disable-blink-features=AutomationControlled",
                  // 其他参数与原来相同
                  "--disable-features=IsolateOrigins,site-per-process",
                  "--disable-site-isolation-trials",
                  "--disable-web-security",
                  "--no-sandbox",
                  "--disable-setuid-sandbox",
                  "--disable-dev-shm-usage",
                  "--disable-accelerated-2d-canvas",
                  "--no-first-run",
                  "--no-zygote",
                  "--disable-gpu",
                  "--hide-scrollbars",
                  "--mute-audio",
                  "--disable-background-networking",
                  "--disable-background-timer-throttling",
                  "--disable-backgrounding-occluded-windows",
                  "--disable-breakpad",
                  "--disable-component-extensions-with-background-pages",
                  "--disable-extensions",
                  "--disable-features=TranslateUI",
                  "--disable-ipc-flooding-protection",
                  "--disable-renderer-backgrounding",
                  "--enable-features=NetworkService,NetworkServiceInProcess",
                  "--force-color-profile=srgb",
                  "--metrics-recording-only",
                ],
                ignoreDefaultArgs: ["--enable-automation"],
              });

              // 使用新的浏览器实例执行搜索
              try {
                const tempContext = await newBrowser.newContext(contextOptions);
                const tempPage = await tempContext.newPage();

                // 这里可以添加处理人机验证的代码
                // ...

                // 完成后关闭临时浏览器
                await newBrowser.close();

                // 重新执行搜索
                return performSearch(false);
              } catch (error) {
                await newBrowser.close();
                throw error;
              }
            } else {
              // 如果不是外部提供的浏览器，直接关闭并重新执行搜索
              await browser.close();
              return performSearch(false); // 以有头模式重新执行搜索
            }
          } else {
            logger.warn(
              "等待搜索结果时检测到人机验证页面，请在浏览器中完成验证..."
            );
            // 等待用户完成验证并重定向回搜索页面
            await page.waitForNavigation({
              timeout: timeout * 2,
              url: (url) => {
                const urlStr = url.toString();
                return sorryPatterns.every(
                  (pattern) => !urlStr.includes(pattern)
                );
              },
            });
            logger.info("人机验证已完成，继续搜索...");

            // 再次尝试等待搜索结果
            for (const selector of searchResultSelectors) {
              try {
                await page.waitForSelector(selector, { timeout: timeout / 2 });
                logger.info({ selector }, "验证后找到搜索结果");
                resultsFound = true;
                break;
              } catch (e) {
                // 继续尝试下一个选择器
              }
            }

            if (!resultsFound) {
              logger.error("无法找到搜索结果元素");
              throw new Error("无法找到搜索结果元素");
            }
          }
        } else {
          // 如果不是人机验证问题，则抛出错误
          logger.error("无法找到搜索结果元素");
          throw new Error("无法找到搜索结果元素");
        }
      }

      // 减少等待时间
      await page.waitForTimeout(getRandomDelay(200, 500));

      logger.info("正在提取搜索结果...");

      let results: SearchResult[] = []; // 在 evaluate 调用之前声明 results

      // 提取搜索结果 - 使用移植自 google-search-extractor.cjs 的逻辑
      results = await page.evaluate((maxResults: number): SearchResult[] => { // 添加返回类型
        const results: { title: string; link: string; snippet: string }[] = [];
        const seenUrls = new Set<string>(); // 用于去重

        // 定义多组选择器，按优先级排序 (参考 google-search-extractor.cjs)
        const selectorSets = [
          { container: '#search div[data-hveid]', title: 'h3', snippet: '.VwiC3b' },
          { container: '#rso div[data-hveid]', title: 'h3', snippet: '[data-sncf="1"]' },
          { container: '.g', title: 'h3', snippet: 'div[style*="webkit-line-clamp"]' },
          { container: 'div[jscontroller][data-hveid]', title: 'h3', snippet: 'div[role="text"]' }
        ];

        // 备用摘要选择器
        const alternativeSnippetSelectors = [
          '.VwiC3b',
          '[data-sncf="1"]',
          'div[style*="webkit-line-clamp"]',
          'div[role="text"]'
        ];

        // 尝试每组选择器
        for (const selectors of selectorSets) {
          if (results.length >= maxResults) break; // 如果已达到数量限制，停止

          const containers = document.querySelectorAll(selectors.container);

          for (const container of containers) {
            if (results.length >= maxResults) break;

            const titleElement = container.querySelector(selectors.title);
            if (!titleElement) continue;

            const title = (titleElement.textContent || "").trim();

            // 查找链接
            let link = '';
            const linkInTitle = titleElement.querySelector('a');
            if (linkInTitle) {
              link = linkInTitle.href;
            } else {
              let current: Element | null = titleElement;
              while (current && current.tagName !== 'A') {
                current = current.parentElement;
              }
              if (current && current instanceof HTMLAnchorElement) {
                link = current.href;
              } else {
                const containerLink = container.querySelector('a');
                if (containerLink) {
                  link = containerLink.href;
                }
              }
            }

            // 过滤无效或重复链接
            if (!link || !link.startsWith('http') || seenUrls.has(link)) continue;

            // 查找摘要
            let snippet = '';
            const snippetElement = container.querySelector(selectors.snippet);
            if (snippetElement) {
              snippet = (snippetElement.textContent || "").trim();
            } else {
              // 尝试其他摘要选择器
              for (const altSelector of alternativeSnippetSelectors) {
                const element = container.querySelector(altSelector);
                if (element) {
                  snippet = (element.textContent || "").trim();
                  break;
                }
              }

              // 如果仍然没有找到摘要，尝试通用方法
              if (!snippet) {
                const textNodes = Array.from(container.querySelectorAll('div')).filter(el =>
                  !el.querySelector('h3') &&
                  (el.textContent || "").trim().length > 20
                );
                if (textNodes.length > 0) {
                  snippet = (textNodes[0].textContent || "").trim();
                }
              }
            }

            // 只添加有标题和链接的结果
            if (title && link) {
              results.push({ title, link, snippet });
              seenUrls.add(link); // 记录已处理的URL
            }
          }
        }
        
        // 如果主要选择器未找到足够结果，尝试更通用的方法 (作为补充)
        if (results.length < maxResults) {
            const anchorElements = Array.from(document.querySelectorAll("a[href^='http']"));
            for (const el of anchorElements) {
                if (results.length >= maxResults) break;

                // 检查 el 是否为 HTMLAnchorElement
                if (!(el instanceof HTMLAnchorElement)) {
                    continue;
                }
                const link = el.href;
                // 过滤掉导航链接、图片链接、已存在链接等
                if (!link || seenUrls.has(link) || link.includes("google.com/") || link.includes("accounts.google") || link.includes("support.google")) {
                    continue;
                }

                const title = (el.textContent || "").trim();
                if (!title) continue; // 跳过没有文本内容的链接

                // 尝试获取周围的文本作为摘要
                let snippet = "";
                let parent = el.parentElement;
                for (let i = 0; i < 3 && parent; i++) {
                  const text = (parent.textContent || "").trim();
                  // 确保摘要文本与标题不同且有一定长度
                  if (text.length > 20 && text !== title) {
                    snippet = text;
                    break; // 找到合适的摘要就停止向上查找
                  }
                  parent = parent.parentElement;
                }

                results.push({ title, link, snippet });
                seenUrls.add(link);
            }
        }

        return results.slice(0, maxResults); // 确保不超过限制
      }, limit); // 将 limit 传递给 evaluate 函数

      logger.info({ count: results.length }, "成功获取到搜索结果");

      try {
        // 保存浏览器状态（除非用户指定了不保存）
        if (!noSaveState) {
          logger.info({ stateFile }, "正在保存浏览器状态...");

          // 确保目录存在
          const stateDir = path.dirname(stateFile);
          if (!fs.existsSync(stateDir)) {
            fs.mkdirSync(stateDir, { recursive: true });
          }

          // 保存状态
          await context.storageState({ path: stateFile });
          logger.info("浏览器状态保存成功!");

          // 保存指纹配置
          try {
            fs.writeFileSync(
              fingerprintFile,
              JSON.stringify(savedState, null, 2),
              "utf8"
            );
            logger.info({ fingerprintFile }, "指纹配置已保存");
          } catch (fingerprintError) {
            logger.error({ error: fingerprintError }, "保存指纹配置时发生错误");
          }
        } else {
          logger.info("根据用户设置，不保存浏览器状态");
        }
      } catch (error) {
        logger.error({ error }, "保存浏览器状态时发生错误");
      }

      // 只有在浏览器不是外部提供的情况下才关闭浏览器
      if (!browserWasProvided) {
        logger.info("正在关闭浏览器...");
        await browser.close();
      } else {
        logger.info("保持浏览器实例打开状态");
      }

      // 返回搜索结果
      return {
        query,
        results, // 现在 results 在这个作用域内是可访问的
      };
    } catch (error) {
      logger.error({ error }, "搜索过程中发生错误");

      try {
        // 尝试保存浏览器状态，即使发生错误
        if (!noSaveState) {
          logger.info({ stateFile }, "正在保存浏览器状态...");
          const stateDir = path.dirname(stateFile);
          if (!fs.existsSync(stateDir)) {
            fs.mkdirSync(stateDir, { recursive: true });
          }
          await context.storageState({ path: stateFile });

          // 保存指纹配置
          try {
            fs.writeFileSync(
              fingerprintFile,
              JSON.stringify(savedState, null, 2),
              "utf8"
            );
            logger.info({ fingerprintFile }, "指纹配置已保存");
          } catch (fingerprintError) {
            logger.error({ error: fingerprintError }, "保存指纹配置时发生错误");
          }
        }
      } catch (stateError) {
        logger.error({ error: stateError }, "保存浏览器状态时发生错误");
      }

      // 只有在浏览器不是外部提供的情况下才关闭浏览器
      if (!browserWasProvided) {
        logger.info("正在关闭浏览器...");
        await browser.close();
      } else {
        logger.info("保持浏览器实例打开状态");
      }

      // 返回错误信息或空结果
      // logger.error 已经记录了错误，这里返回一个包含错误信息的模拟结果
       return {
         query,
         results: [
           {
             title: "搜索失败",
             link: "",
             snippet: `无法完成搜索，错误信息: ${
               error instanceof Error ? error.message : String(error)
             }`,
           },
         ],
       };
    }
    // 移除 finally 块，因为资源清理已经在 try 和 catch 块中处理
  }

  // 首先尝试以无头模式执行搜索
  return performSearch(useHeadless);
}

/**
 * 获取Google搜索结果页面的原始HTML
 * @param query 搜索关键词
 * @param options 搜索选项
 * @param saveToFile 是否将HTML保存到文件（可选）
 * @param outputPath HTML输出文件路径（可选，默认为'./google-search-html/[query]-[timestamp].html'）
 * @returns 包含HTML内容的响应对象
 */
export async function getGoogleSearchPageHtml(
  query: string,
  options: CommandOptions = {},
  saveToFile: boolean = false,
  outputPath?: string
): Promise<HtmlResponse> {
  // 设置默认选项，与googleSearch保持一致
  const {
    timeout = 60000,
    stateFile = "./browser-state.json",
    noSaveState = false,
    locale = "zh-CN", // 默认使用中文
  } = options;

  // 忽略传入的headless参数，总是以无头模式启动
  let useHeadless = true;

  logger.info({ options }, "正在初始化浏览器以获取搜索页面HTML...");

  // 复用googleSearch中的浏览器初始化代码
  // 检查是否存在状态文件
  let storageState: string | undefined = undefined;
  let savedState: SavedState = {};

  // 指纹配置文件路径
  const fingerprintFile = stateFile.replace(".json", "-fingerprint.json");

  if (fs.existsSync(stateFile)) {
    logger.info(
      { stateFile },
      "发现浏览器状态文件，将使用保存的浏览器状态以避免反机器人检测"
    );
    storageState = stateFile;

    // 尝试加载保存的指纹配置
    if (fs.existsSync(fingerprintFile)) {
      try {
        const fingerprintData = fs.readFileSync(fingerprintFile, "utf8");
        savedState = JSON.parse(fingerprintData);
        logger.info("已加载保存的浏览器指纹配置");
      } catch (e) {
        logger.warn({ error: e }, "无法加载指纹配置文件，将创建新的指纹");
      }
    }
  } else {
    logger.info(
      { stateFile },
      "未找到浏览器状态文件，将创建新的浏览器会话和指纹"
    );
  }

  // 只使用桌面设备列表
  const deviceList = [
    "Desktop Chrome",
    "Desktop Edge",
    "Desktop Firefox",
    "Desktop Safari",
  ];

  // Google域名列表
  const googleDomains = [
    "https://www.google.com",
    "https://www.google.co.uk",
    "https://www.google.ca",
    "https://www.google.com.au",
  ];

  // 获取随机设备配置或使用保存的配置
  const getDeviceConfig = (): [string, any] => {
    if (
      savedState.fingerprint?.deviceName &&
      devices[savedState.fingerprint.deviceName]
    ) {
      // 使用保存的设备配置
      return [
        savedState.fingerprint.deviceName,
        devices[savedState.fingerprint.deviceName],
      ];
    } else {
      // 随机选择一个设备
      const randomDevice =
        deviceList[Math.floor(Math.random() * deviceList.length)];
      return [randomDevice, devices[randomDevice]];
    }
  };

  // 获取随机延迟时间
  const getRandomDelay = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  // 定义一个专门的函数来获取HTML
  async function performSearchAndGetHtml(headless: boolean): Promise<HtmlResponse> {
    let browser: Browser;
    
    // 初始化浏览器，添加更多参数以避免检测
    browser = await chromium.launch({
      headless,
      timeout: timeout * 2, // 增加浏览器启动超时时间
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-site-isolation-trials",
        "--disable-web-security",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--hide-scrollbars",
        "--mute-audio",
        "--disable-background-networking",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-breakpad",
        "--disable-component-extensions-with-background-pages",
        "--disable-extensions",
        "--disable-features=TranslateUI",
        "--disable-ipc-flooding-protection",
        "--disable-renderer-backgrounding",
        "--enable-features=NetworkService,NetworkServiceInProcess",
        "--force-color-profile=srgb",
        "--metrics-recording-only",
      ],
      ignoreDefaultArgs: ["--enable-automation"],
    });

    logger.info("浏览器已成功启动!");

    // 获取设备配置 - 使用保存的或随机生成
    const [deviceName, deviceConfig] = getDeviceConfig();

    // 创建浏览器上下文选项
    let contextOptions: BrowserContextOptions = {
      ...deviceConfig,
    };

    // 如果有保存的指纹配置，使用它；否则使用宿主机器的实际设置
    if (savedState.fingerprint) {
      contextOptions = {
        ...contextOptions,
        locale: savedState.fingerprint.locale,
        timezoneId: savedState.fingerprint.timezoneId,
        colorScheme: savedState.fingerprint.colorScheme,
        reducedMotion: savedState.fingerprint.reducedMotion,
        forcedColors: savedState.fingerprint.forcedColors,
      };
      logger.info("使用保存的浏览器指纹配置");
    } else {
      // 获取宿主机器的实际设置
      const hostConfig = getHostMachineConfig(locale);

      // 如果需要使用不同的设备类型，重新获取设备配置
      if (hostConfig.deviceName !== deviceName) {
        logger.info(
          { deviceType: hostConfig.deviceName },
          "根据宿主机器设置使用设备类型"
        );
        // 使用新的设备配置
        contextOptions = { ...devices[hostConfig.deviceName] };
      }

      contextOptions = {
        ...contextOptions,
        locale: hostConfig.locale,
        timezoneId: hostConfig.timezoneId,
        colorScheme: hostConfig.colorScheme,
        reducedMotion: hostConfig.reducedMotion,
        forcedColors: hostConfig.forcedColors,
      };

      // 保存新生成的指纹配置
      savedState.fingerprint = hostConfig;
      logger.info(
        {
          locale: hostConfig.locale,
          timezone: hostConfig.timezoneId,
          colorScheme: hostConfig.colorScheme,
          deviceType: hostConfig.deviceName,
        },
        "已根据宿主机器生成新的浏览器指纹配置"
      );
    }

    // 添加通用选项 - 确保使用桌面配置
    contextOptions = {
      ...contextOptions,
      permissions: ["geolocation", "notifications"],
      acceptDownloads: true,
      isMobile: false, // 强制使用桌面模式
      hasTouch: false, // 禁用触摸功能
      javaScriptEnabled: true,
    };

    if (storageState) {
      logger.info("正在加载保存的浏览器状态...");
    }

    const context = await browser.newContext(
      storageState ? { ...contextOptions, storageState } : contextOptions
    );

    // 设置额外的浏览器属性以避免检测
    await context.addInitScript(() => {
      // 覆盖 navigator 属性
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5],
      });
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en", "zh-CN"],
      });

      // 覆盖 window 属性
      // @ts-ignore - 忽略 chrome 属性不存在的错误
      window.chrome = {
        runtime: {},
        loadTimes: function () {},
        csi: function () {},
        app: {},
      };

      // 添加 WebGL 指纹随机化
      if (typeof WebGLRenderingContext !== "undefined") {
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function (
          parameter: number
        ) {
          // 随机化 UNMASKED_VENDOR_WEBGL 和 UNMASKED_RENDERER_WEBGL
          if (parameter === 37445) {
            return "Intel Inc.";
          }
          if (parameter === 37446) {
            return "Intel Iris OpenGL Engine";
          }
          return getParameter.call(this, parameter);
        };
      }
    });

    const page = await context.newPage();

    // 设置页面额外属性
    await page.addInitScript(() => {
      // 模拟真实的屏幕尺寸和颜色深度
      Object.defineProperty(window.screen, "width", { get: () => 1920 });
      Object.defineProperty(window.screen, "height", { get: () => 1080 });
      Object.defineProperty(window.screen, "colorDepth", { get: () => 24 });
      Object.defineProperty(window.screen, "pixelDepth", { get: () => 24 });
    });

    try {
      // 使用保存的Google域名或随机选择一个
      let selectedDomain: string;
      if (savedState.googleDomain) {
        selectedDomain = savedState.googleDomain;
        logger.info({ domain: selectedDomain }, "使用保存的Google域名");
      } else {
        selectedDomain =
          googleDomains[Math.floor(Math.random() * googleDomains.length)];
        // 保存选择的域名
        savedState.googleDomain = selectedDomain;
        logger.info({ domain: selectedDomain }, "随机选择Google域名");
      }

      logger.info("正在访问Google搜索页面...");

      // 访问Google搜索页面
      const response = await page.goto(selectedDomain, {
        timeout,
        waitUntil: "networkidle",
      });

      // 检查是否被重定向到人机验证页面
      const currentUrl = page.url();
      const sorryPatterns = [
        "google.com/sorry/index",
        "google.com/sorry",
        "recaptcha",
        "captcha",
        "unusual traffic",
      ];

      const isBlockedPage = sorryPatterns.some(
        (pattern) =>
          currentUrl.includes(pattern) ||
          (response && response.url().toString().includes(pattern))
      );

      if (isBlockedPage) {
        if (headless) {
          logger.warn("检测到人机验证页面，将以有头模式重新启动浏览器...");

          // 关闭当前页面和上下文
          await page.close();
          await context.close();
          await browser.close();
          
          // 以有头模式重新执行
          return performSearchAndGetHtml(false);
        } else {
          logger.warn("检测到人机验证页面，请在浏览器中完成验证...");
          // 等待用户完成验证并重定向回搜索页面
          await page.waitForNavigation({
            timeout: timeout * 2,
            url: (url) => {
              const urlStr = url.toString();
              return sorryPatterns.every(
                (pattern) => !urlStr.includes(pattern)
              );
            },
          });
          logger.info("人机验证已完成，继续搜索...");
        }
      }

      logger.info({ query }, "正在输入搜索关键词");

      // 等待搜索框出现 - 尝试多个可能的选择器
      const searchInputSelectors = [
        "textarea[name='q']",
        "input[name='q']",
        "textarea[title='Search']",
        "input[title='Search']",
        "textarea[aria-label='Search']",
        "input[aria-label='Search']",
        "textarea",
      ];

      let searchInput = null;
      for (const selector of searchInputSelectors) {
        searchInput = await page.$(selector);
        if (searchInput) {
          logger.info({ selector }, "找到搜索框");
          break;
        }
      }

      if (!searchInput) {
        logger.error("无法找到搜索框");
        throw new Error("无法找到搜索框");
      }

      // 直接点击搜索框，减少延迟
      await searchInput.click();

      // 直接输入整个查询字符串，而不是逐个字符输入
      await page.keyboard.type(query, { delay: getRandomDelay(10, 30) });

      // 减少按回车前的延迟
      await page.waitForTimeout(getRandomDelay(100, 300));
      await page.keyboard.press("Enter");

      logger.info("正在等待搜索结果页面加载完成...");

      // 等待页面加载完成
      await page.waitForLoadState("networkidle", { timeout });

      // 检查搜索后的URL是否被重定向到人机验证页面
      const searchUrl = page.url();
      const isBlockedAfterSearch = sorryPatterns.some((pattern) =>
        searchUrl.includes(pattern)
      );

      if (isBlockedAfterSearch) {
        if (headless) {
          logger.warn("搜索后检测到人机验证页面，将以有头模式重新启动浏览器...");

          // 关闭当前页面和上下文
          await page.close();
          await context.close();
          await browser.close();
          
          // 以有头模式重新执行
          return performSearchAndGetHtml(false);
        } else {
          logger.warn("搜索后检测到人机验证页面，请在浏览器中完成验证...");
          // 等待用户完成验证并重定向回搜索页面
          await page.waitForNavigation({
            timeout: timeout * 2,
            url: (url) => {
              const urlStr = url.toString();
              return sorryPatterns.every(
                (pattern) => !urlStr.includes(pattern)
              );
            },
          });
          logger.info("人机验证已完成，继续搜索...");

          // 等待页面重新加载
          await page.waitForLoadState("networkidle", { timeout });
        }
      }

      // 获取当前页面URL
      const finalUrl = page.url();
      logger.info({ url: finalUrl }, "搜索结果页面已加载，准备提取HTML...");

      // 添加额外的等待时间，确保页面完全加载和稳定
      logger.info("等待页面稳定...");
      await page.waitForTimeout(1000); // 等待1秒，让页面完全稳定
      
      // 再次等待网络空闲，确保所有异步操作完成
      await page.waitForLoadState("networkidle", { timeout });
      
      // 获取页面HTML内容
      const fullHtml = await page.content();
      
      // 移除CSS和JavaScript内容，只保留纯HTML
      // 移除所有<style>标签及其内容
      let html = fullHtml.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
      // 移除所有<link rel="stylesheet">标签
      html = html.replace(/<link\s+[^>]*rel=["']stylesheet["'][^>]*>/gi, '');
      // 移除所有<script>标签及其内容
      html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      
      logger.info({
        originalLength: fullHtml.length,
        cleanedLength: html.length
      }, "成功获取并清理页面HTML内容");

      // 如果需要，将HTML保存到文件并截图
      let savedFilePath: string | undefined = undefined;
      let screenshotPath: string | undefined = undefined;
      
      if (saveToFile) {
        // 生成默认文件名（如果未提供）
        if (!outputPath) {
          // 确保目录存在
          const outputDir = "./google-search-html";
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          // 生成文件名：查询词-时间戳.html
          const timestamp = new Date().toISOString().replace(/:/g, "-").replace(/\./g, "-");
          const sanitizedQuery = query.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 50);
          outputPath = `${outputDir}/${sanitizedQuery}-${timestamp}.html`;
        }

        // 确保文件目录存在
        const fileDir = path.dirname(outputPath);
        if (!fs.existsSync(fileDir)) {
          fs.mkdirSync(fileDir, { recursive: true });
        }

        // 写入HTML文件
        fs.writeFileSync(outputPath, html, "utf8");
        savedFilePath = outputPath;
        logger.info({ path: outputPath }, "清理后的HTML内容已保存到文件");
        
        // 保存网页截图
        // 生成截图文件名（基于HTML文件名，但扩展名为.png）
        const screenshotFilePath = outputPath.replace(/\.html$/, '.png');
        
        // 截取整个页面的截图
        logger.info("正在截取网页截图...");
        await page.screenshot({
          path: screenshotFilePath,
          fullPage: true
        });
        
        screenshotPath = screenshotFilePath;
        logger.info({ path: screenshotFilePath }, "网页截图已保存");
      }

      try {
        // 保存浏览器状态（除非用户指定了不保存）
        if (!noSaveState) {
          logger.info({ stateFile }, "正在保存浏览器状态...");

          // 确保目录存在
          const stateDir = path.dirname(stateFile);
          if (!fs.existsSync(stateDir)) {
            fs.mkdirSync(stateDir, { recursive: true });
          }

          // 保存状态
          await context.storageState({ path: stateFile });
          logger.info("浏览器状态保存成功!");

          // 保存指纹配置
          try {
            fs.writeFileSync(
              fingerprintFile,
              JSON.stringify(savedState, null, 2),
              "utf8"
            );
            logger.info({ fingerprintFile }, "指纹配置已保存");
          } catch (fingerprintError) {
            logger.error({ error: fingerprintError }, "保存指纹配置时发生错误");
          }
        } else {
          logger.info("根据用户设置，不保存浏览器状态");
        }
      } catch (error) {
        logger.error({ error }, "保存浏览器状态时发生错误");
      }

      // 关闭浏览器
      logger.info("正在关闭浏览器...");
      await browser.close();

      // 返回HTML响应
      return {
        query,
        html,
        url: finalUrl,
        savedPath: savedFilePath,
        screenshotPath: screenshotPath,
        originalHtmlLength: fullHtml.length
      };
    } catch (error) {
      logger.error({ error }, "获取页面HTML过程中发生错误");

      try {
        // 尝试保存浏览器状态，即使发生错误
        if (!noSaveState) {
          logger.info({ stateFile }, "正在保存浏览器状态...");
          const stateDir = path.dirname(stateFile);
          if (!fs.existsSync(stateDir)) {
            fs.mkdirSync(stateDir, { recursive: true });
          }
          await context.storageState({ path: stateFile });

          // 保存指纹配置
          try {
            fs.writeFileSync(
              fingerprintFile,
              JSON.stringify(savedState, null, 2),
              "utf8"
            );
            logger.info({ fingerprintFile }, "指纹配置已保存");
          } catch (fingerprintError) {
            logger.error({ error: fingerprintError }, "保存指纹配置时发生错误");
          }
        }
      } catch (stateError) {
        logger.error({ error: stateError }, "保存浏览器状态时发生错误");
      }

      // 关闭浏览器
      logger.info("正在关闭浏览器...");
      await browser.close();

      // 返回错误信息
      throw new Error(`获取Google搜索页面HTML失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 首先尝试以无头模式执行
  return performSearchAndGetHtml(useHeadless);
}
