/** @type {import('tailwindcss').Config} */
export default {
  content: ["./*{.html,js}", "./public/*{.html,js}"],
  theme: {
    extend: {},
  },
  plugins: [
    require("@tailwindcss/typography"),
    require("@tailwindcss/forms"),
    require("daisyui"),
  ],
  daisyui: {
    logs: false,
  },
};
