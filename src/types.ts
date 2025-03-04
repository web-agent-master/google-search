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
  headless?: boolean;
  remoteDebuggingPort?: number;
  stateFile?: string;
  noSaveState?: boolean;
}
