import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";

import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CircleIcon from "@mui/icons-material/Circle";

import Editor from "@monaco-editor/react";
import * as monaco from "monaco-editor";

import { tokens } from "../theme/theme";

export interface OpenTab {
  path: string;
  content: string;
  isDirty: boolean;
}

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  json: "json",
  css: "css",
  scss: "scss",
  html: "html",
  md: "markdown",
  py: "python",
  yml: "yaml",
  yaml: "yaml",
  sql: "sql",
  sh: "shell",
};

function languageForPath(path: string) {
  const extension =
    path.split(".").pop()?.toLowerCase() ?? "";

  return EXTENSION_LANGUAGE_MAP[extension] ?? "plaintext";
}

interface EditorPaneProps {
  tabs: OpenTab[];
  activePath: string | null;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string) => void;
  onContentChange: (path: string, content: string) => void;
  onSave: (path: string) => void;
}

function registerCodeActions(
  monaco: typeof import("monaco-editor")
) {
  const languages = [
    "javascript",
    "typescript",
    "json",
    "css",
    "scss",
    "html",
    "markdown",
    "python",
    "java",
    "cpp",
    "csharp",
    "go",
    "rust",
    "php",
    "sql",
    "shell",
  ];

  const disposables = languages.map((language) =>
    monaco.languages.registerCodeActionProvider(language, {
      provideCodeActions(model, range) {
        const selectedText =
          model.getValueInRange(range);

        console.log(
          "Code action:",
          language,
          selectedText
        );

        if (!selectedText.includes("console.log")) {
          return {
            actions: [],
            dispose: () => {},
          };
        }

        const action: monaco.languages.CodeAction = {
          title:
            "Replace console.log with console.info",

          kind: "quickfix",

          isPreferred: true,

          diagnostics: [],

          edit: {
            edits: [
              {
                resource: model.uri,

                versionId: model.getVersionId(),

                textEdit: {
                  range,

                  text: selectedText.replace(
                    "console.log",
                    "console.info"
                  ),
                },
              },
            ],
          },
        };

        return {
          actions: [action],
          dispose: () => {},
        };
      },
    })
  );

  return () => {
    disposables.forEach((disposable) =>
      disposable.dispose()
    );
  };
}

export default function EditorPane({
  tabs,
  activePath,
  onSelectTab,
  onCloseTab,
  onContentChange,
  onSave,
}: EditorPaneProps) {
  const activeTab = tabs.find(
    (tab) => tab.path === activePath
  );

  if (tabs.length === 0) {
    return (
      <Box
        sx={{
          flex: 1,
          bgcolor: tokens.editor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography
          sx={{
            fontSize: 13,
            color: tokens.mutedDim,
          }}
        >
          Select a file from the Explorer
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        bgcolor: tokens.editor,
      }}
    >
      {/* Tabs */}
      <Stack
        direction="row"
        sx={{
          height: 35,
          bgcolor: tokens.sidebar,
          borderBottom: `1px solid ${tokens.border}`,
          overflowX: "auto",

          "&::-webkit-scrollbar": {
            display: "none",
          },
        }}
      >
        {tabs.map((tab) => {
          const name =
            tab.path.split("/").pop() ?? tab.path;

          const isActive =
            tab.path === activePath;

          return (
            <Stack
              key={tab.path}
              direction="row"
              onClick={() =>
                onSelectTab(tab.path)
              }
              sx={{
                minWidth: 130,
                maxWidth: 180,
                height: 35,

                px: 1.25,

                alignItems: "center",
                gap: 0.75,

                cursor: "pointer",

                bgcolor: isActive
                  ? tokens.editor
                  : tokens.sidebar,

                borderRight:
                  `1px solid ${tokens.border}`,

                borderTop: isActive
                  ? `1px solid ${tokens.accent}`
                  : "1px solid transparent",

                "&:hover": {
                  bgcolor: tokens.editor,
                },
              }}
            >
              <Typography
                sx={{
                  flex: 1,
                  minWidth: 0,

                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",

                  fontSize: 12.5,

                  color: isActive
                    ? tokens.textBright
                    : tokens.muted,
                }}
              >
                {name}
              </Typography>

              {tab.isDirty ? (
                <CircleIcon
                  sx={{
                    fontSize: 7,
                    color: tokens.text,
                  }}
                />
              ) : (
                <IconButton
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCloseTab(tab.path);
                  }}
                  sx={{
                    p: 0.25,
                    color: tokens.muted,

                    "&:hover": {
                      bgcolor: tokens.hover,
                      color: tokens.text,
                    },
                  }}
                >
                  <CloseRoundedIcon
                    sx={{ fontSize: 14 }}
                  />
                </IconButton>
              )}
            </Stack>
          );
        })}
      </Stack>

      {/* Breadcrumb */}
      {activeTab && (
        <Stack
          direction="row"
          sx={{
            height: 26,
            px: 1.5,
            alignItems: "center",
            gap: 0.5,

            bgcolor: tokens.editor,
            borderBottom:
              `1px solid ${tokens.border}`,
          }}
        >
          {activeTab.path
            .split("/")
            .map((part, index, array) => (
              <Stack
                direction="row"
                key={`${part}-${index}`}
                sx={{
                  alignItems: "center",
                  gap: 0.5,
                }}
              >
                <Typography
                  sx={{
                    fontSize: 11,
                    color:
                      index === array.length - 1
                        ? tokens.text
                        : tokens.muted,
                  }}
                >
                  {part}
                </Typography>

                {index < array.length - 1 && (
                  <Typography
                    sx={{
                      fontSize: 11,
                      color: tokens.mutedDim,
                    }}
                  >
                    ›
                  </Typography>
                )}
              </Stack>
            ))}
        </Stack>
      )}

      {/* Monaco */}
      {activeTab && (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
          }}
        >
          <Editor
            path={activeTab.path}
            language={languageForPath(
              activeTab.path
            )}
            value={activeTab.content}
            theme="vs-dark"
            beforeMount={(monaco) => {
              registerCodeActions(monaco);
            }}
            onChange={(value) =>
              onContentChange(
                activeTab.path,
                value ?? ""
              )
            }
            options={{
              fontSize: 13,
              fontFamily:
                "'SF Mono', Monaco, Menlo, Consolas, monospace",

              minimap: {
                enabled: true,
              },

              automaticLayout: true,

              smoothScrolling: true,

              cursorBlinking: "smooth",

              padding: {
                top: 10,
                bottom: 10,
              },

              renderWhitespace: "selection",

              scrollBeyondLastLine: false,

              lineNumbersMinChars: 3,

              folding: true,

              bracketPairColorization: {
                enabled: true,
              },

              guides: {
                indentation: true,
                bracketPairs: true,
                highlightActiveBracketPair: true
              },

              scrollbar: {
                verticalScrollbarSize: 10,
                horizontalScrollbarSize: 10,
              },
            }}
            keepCurrentModel
           onMount={(editor, monaco) => {
  editor.addCommand(
    monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
    () => {
      onSave(activeTab.path);
    }
  );

  console.log(
    "EDITOR LANGUAGE:",
    editor.getModel()?.getLanguageId()
  );

  monaco.languages.registerCodeActionProvider("typescript", {
    provideCodeActions(model:any, range:any) {
      console.log("🔥 CODE ACTION PROVIDER CALLED");

      console.log("language:", model.getLanguageId());
      console.log("selected:", model.getValueInRange(range));

      const action: monaco.languages.CodeAction = {
        title: "🔥 TEST CODE ACTION",
        kind: "quickfix",
        isPreferred: true,
      };

      return {
        actions: [action],
        dispose: () => {},
      };
    },
  });
}}
          />
        </Box>
      )}
    </Box>
  );
}