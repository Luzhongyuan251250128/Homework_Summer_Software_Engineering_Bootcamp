import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// 注：vitest 2.1.x 的类型基于其内置 vite 5，而 @vitejs/plugin-react 基于根 vite 6——
// PluginOption 结构不兼容（TS2769）。运行时无影响，此处做类型断言（T12 记录）。
export default defineConfig({
  plugins: [react() as never],
  server: { proxy: { "/api": "http://localhost:8000" } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
