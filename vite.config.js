// vite.config.js (минималистичный)
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  // Эта настройка обязательна для вашего проекта, если он лежит в поддиректории.
  base: '/cossacks-replay-parser/',

  // Vite по умолчанию уже делает много чего:
  // - Для продакшена использует Terser с хорошими настройками.
  // - Цель сборки (target) по умолчанию - 'modules' (поддержка нативных ES-модулей).
  // - Минификация включена.
  // Мы лишь добавляем удаление console.log для продакшена.
  // build: {
  //   terserOptions: {
  //     compress: {
  //       drop_console: true, // Удаляем консоль в продакшене
  //     },
  //   },
  // },


  //   build: {
  //   minify: "terser",
  //   terserOptions: {
  //     keep_fnames: true, // имена функций
  //     keep_classnames: true, // имена классов
  //     compress: {
  //       drop_console: true,
  //     },
  //   },
  // },
});