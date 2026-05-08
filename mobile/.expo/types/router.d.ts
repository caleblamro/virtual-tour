/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string | object = string> {
      hrefInputParams: { pathname: Router.RelativePathString, params?: Router.UnknownInputParams } | { pathname: Router.ExternalPathString, params?: Router.UnknownInputParams } | { pathname: `/capture`; params?: Router.UnknownInputParams; } | { pathname: `/_sitemap`; params?: Router.UnknownInputParams; } | { pathname: `${'/(tabs)'}` | `/`; params?: Router.UnknownInputParams; } | { pathname: `/processing/[jobId]`, params: Router.UnknownInputParams & { jobId: string | number; } } | { pathname: `/viewer/[jobId]`, params: Router.UnknownInputParams & { jobId: string | number; } };
      hrefOutputParams: { pathname: Router.RelativePathString, params?: Router.UnknownOutputParams } | { pathname: Router.ExternalPathString, params?: Router.UnknownOutputParams } | { pathname: `/capture`; params?: Router.UnknownOutputParams; } | { pathname: `/_sitemap`; params?: Router.UnknownOutputParams; } | { pathname: `${'/(tabs)'}` | `/`; params?: Router.UnknownOutputParams; } | { pathname: `/processing/[jobId]`, params: Router.UnknownOutputParams & { jobId: string; } } | { pathname: `/viewer/[jobId]`, params: Router.UnknownOutputParams & { jobId: string; } };
      href: Router.RelativePathString | Router.ExternalPathString | `/capture${`?${string}` | `#${string}` | ''}` | `/_sitemap${`?${string}` | `#${string}` | ''}` | `${'/(tabs)'}${`?${string}` | `#${string}` | ''}` | `/${`?${string}` | `#${string}` | ''}` | { pathname: Router.RelativePathString, params?: Router.UnknownInputParams } | { pathname: Router.ExternalPathString, params?: Router.UnknownInputParams } | { pathname: `/capture`; params?: Router.UnknownInputParams; } | { pathname: `/_sitemap`; params?: Router.UnknownInputParams; } | { pathname: `${'/(tabs)'}` | `/`; params?: Router.UnknownInputParams; } | `/processing/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ''}` | `/viewer/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ''}` | { pathname: `/processing/[jobId]`, params: Router.UnknownInputParams & { jobId: string | number; } } | { pathname: `/viewer/[jobId]`, params: Router.UnknownInputParams & { jobId: string | number; } };
    }
  }
}
