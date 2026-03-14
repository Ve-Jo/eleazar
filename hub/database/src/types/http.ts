type RequestLike = {
  method: string;
  path: string;
  params?: Record<string, string>;
  query?: Record<string, string | undefined>;
  body?: Record<string, unknown>;
  get?: (header: string) => string | undefined;
  ip?: string;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (body: unknown) => ResponseLike;
};

type NextFunctionLike = () => void;

type ErrorLike = {
  message?: string;
};

export type { RequestLike, ResponseLike, NextFunctionLike, ErrorLike };
