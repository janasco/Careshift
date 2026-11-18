// Compatibility aliases used while the web app moves off Convex.
// API records use string IDs; these keep the existing page annotations valid.
export type Id<T extends string = string> = string & { readonly __table?: T };
export type Doc<T extends string = string> = Record<string, any> & {
  readonly __table?: T;
};
