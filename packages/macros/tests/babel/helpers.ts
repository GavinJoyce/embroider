import { MacrosConfig } from '../..';
import { join, dirname } from 'path';
import { allBabelVersions as allBabel, runDefault, Transform, toCJS, toJS } from '@embroider/test-support';
import { readFileSync } from 'fs';
import { Script, createContext } from 'vm';
import { explicitRelative } from '@embroider/core';

export { runDefault };

const runtimeFilename = join(__dirname, '../../src/babel/runtime.ts');

export function makeRunner(transform: Transform) {
  let cachedMacrosPackage: typeof import('../../src/babel/runtime');

  return function run(code: string, opts?: { filename: string }) {
    let optsWithDefaults = Object.assign(
      {
        filename: join(__dirname, 'sample.js'),
      },
      opts
    );
    if (!cachedMacrosPackage) {
      let tsSrc = readFileSync(runtimeFilename, 'utf8');
      let jsSrc = toJS(tsSrc);
      let withInlinedConfig = transform(jsSrc, { filename: runtimeFilename });
      let cjsSrc = toCJS(withInlinedConfig);
      let script = new Script(cjsSrc);
      let context = createContext({
        exports: {},
        require(name: string) {
          if (name === './macros-config') {
            return {
              default: {},
              Merger: {},
            };
          }
          throw new Error(`bug in test setup: no implementation for ${name}`);
        },
      });
      script.runInContext(context);
      cachedMacrosPackage = context.exports;
    }
    return runDefault(code, {
      dependencies: {
        [explicitRelative(
          dirname(optsWithDefaults.filename),
          runtimeFilename.replace(/\.[tj]s$/, '')
        )]: cachedMacrosPackage,
      },
    });
  };
}

type CreateTestsWithConfig = (transform: Transform, config: MacrosConfig) => void;

export function makeBabelConfig(_babelVersion: number, macroConfig: MacrosConfig) {
  return {
    filename: join(__dirname, 'sample.js'),
    presets: [],
    plugins: [macroConfig.babelPluginConfig()],
  };
}

type CreateTests = (transform: Transform) => void;
interface ModeTestHooks {
  runTimeTest: typeof test;
  buildTimeTest: typeof test;
  applyMode: (m: MacrosConfig) => void;
}
type CreateModeTests = (transform: Transform, hooks: ModeTestHooks) => void;

function disabledTest(_name: string, _impl: jest.ProvidesCallback | undefined) {}
disabledTest.only = disabledTest;
disabledTest.skip = disabledTest;
disabledTest.todo = disabledTest;
disabledTest.concurrent = disabledTest;
disabledTest.each = test.each;

export function allModes(fn: CreateModeTests): CreateTests {
  return function createTests(transform: Transform) {
    for (let mode of ['build-time', 'run-time']) {
      describe(mode, function() {
        function applyMode(macrosConfig: MacrosConfig) {
          if (mode === 'run-time') {
            macrosConfig.enableRuntimeMode();
          }
        }
        fn(transform, {
          runTimeTest: mode === 'run-time' ? test : disabledTest,
          buildTimeTest: mode === 'build-time' ? test : disabledTest,
          applyMode,
        });
      });
    }
  };
}

export function allBabelVersions(createTests: CreateTests | CreateTestsWithConfig) {
  let config: MacrosConfig;
  allBabel({
    includePresetsTests: true,
    babelConfig() {
      return {
        filename: join(__dirname, 'sample.js'),
        presets: [],
        plugins: [config.babelPluginConfig()],
      };
    },

    createTests(transform) {
      config = MacrosConfig.for({});
      if (createTests.length === 1) {
        // The caller will not be using `config`, so we finalize it for them.
        config.finalize();
        (createTests as CreateTests)(transform);
      } else {
        // The caller is receivng `config` and they are responsible for
        // finalizing it.
        (createTests as CreateTestsWithConfig)(transform, config!);
      }
    },
  });
}
