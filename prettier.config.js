/** @type {import('prettier').Config } */
const config = {
  plugins: [],
  semi: false,
  printWidth: 80,
  tabWidth: 2,
  importOrder: ["<THIRD_PARTY_MODULES>", "^[./]"],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
}

export default config
