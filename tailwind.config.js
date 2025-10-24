export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  future: {
    disableLightningcss: true, // 👈 this is the key line
  },
}