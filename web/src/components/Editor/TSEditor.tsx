import { useEffect, useRef } from "react";
import { Spinner } from "@chakra-ui/react";
import { Editor, Monaco } from "@monaco-editor/react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";

import { AutoImportTypings } from "@/components/Editor/typesResolve";
import { COLOR_MODE } from "@/constants";

import "./useWorker";

import useFunctionCache from "@/hooks/useFunctionCache";
import useFunctionStore from "@/pages/app/functions/store";

const autoImportTypings = new AutoImportTypings();

export default function TSEditor(props: {
  value: string;
  path: string;
  fontSize: number;
  colorMode?: string;
  onChange: (value: string | undefined) => void;
}) {
  const { value, path, fontSize, onChange, colorMode } = props;

  const functionCache = useFunctionCache();
  const { currentFunction } = useFunctionStore((state) => state);

  const monacoRef = useRef<Monaco>();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>();

  function handleEditorDidMount(editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) {
    monacoRef.current = monaco;
    editorRef.current = editor;
    setTimeout(() => {
      autoImportTypings.loadDefaults(monacoRef.current);
    }, 10);
  }

  useEffect(() => {
    const pos = JSON.parse(functionCache.getPositionCache(path) || "{}");
    if (pos.lineNumber && pos.column) {
      editorRef.current?.setPosition(pos);
      editorRef.current?.revealPositionInCenter(pos);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  const options = {
    minimap: {
      enabled: false,
    },
    language: "typescript",
    automaticLayout: true,
    scrollbar: {
      verticalScrollbarSize: 4,
      horizontalScrollbarSize: 8,
    },
    formatOnPaste: true,
    overviewRulerLanes: 0,
    lineNumbersMinChars: 4,
    fontSize: fontSize,
    fontFamily: "Fira Code",
    fontWeight: "450",
    scrollBeyondLastLine: false,
  };

  return (
    <Editor
      height={"100%"}
      value={value}
      path={`file://${path}`}
      options={options}
      theme={colorMode === COLOR_MODE.dark ? "vs-dark" : "light"}
      onChange={(value) => {
        onChange(value);
        functionCache.setPositionCache(
          currentFunction!.name,
          JSON.stringify(editorRef.current?.getPosition()),
        );
      }}
      loading={
        <div>
          <Spinner />
        </div>
      }
      beforeMount={(monaco) => {
        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: true,
          noSyntaxValidation: false,
        });

        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
          target: monaco.languages.typescript.ScriptTarget.ESNext,
          allowNonTsExtensions: true,
          moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
          module: monaco.languages.typescript.ModuleKind.CommonJS,
          allowSyntheticDefaultImports: true,
          noEmit: true,
          allowJs: false,
          sourceMap: true,
          noImplicitAny: false,
        });

        monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
      }}
      onMount={handleEditorDidMount}
      onValidate={() => {
        autoImportTypings.parse(value, monacoRef.current);
      }}
    />
  );
}
