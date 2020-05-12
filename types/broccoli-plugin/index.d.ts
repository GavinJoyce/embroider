declare module 'broccoli-plugin' {
  export interface Tree {
    __broccoliGetInfo__(): any;
  }

  export interface Options {
    name?: string;
    annotation?: string;
    persistentOutput?: boolean;
    needsCache?: boolean;
    trackInputChanges?: boolean;
  }

  export default abstract class Plugin implements Tree {
    constructor(inputTrees: Tree[], options: Options);
    inputPaths: string[];
    outputPath: string;
    cachePath: string;
    __broccoliGetInfo__(): any;
    abstract build(detail: undefined | { changedNodes: boolean[] }): Promise<void> | void;
  }
}
