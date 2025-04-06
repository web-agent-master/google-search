/**
 * 搜索结果接口
 */
export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

/**
 * 搜索响应接口
 */
export interface SearchResponse {
  query: string;
  results: SearchResult[];
}

/**
 * 命令行选项接口
 */
export interface CommandOptions {
  limit?: number;
  timeout?: number;
  headless?: boolean; // 已废弃，但保留以兼容现有代码
  stateFile?: string;
  noSaveState?: boolean;
  locale?: string; // 搜索结果语言，默认为中文(zh-CN)
}

/**
 * HTML响应接口 - 用于获取原始搜索页面HTML
 */
export interface HtmlResponse {
  query: string;    // 搜索查询
  html: string;     // 页面HTML内容
  url: string;      // 搜索结果页面URL
  savedPath?: string; // 可选，如果HTML保存到文件，则为保存路径
}
