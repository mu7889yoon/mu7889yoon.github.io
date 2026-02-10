import { merjongAPI } from "./merjongAPI.js"

export { merjongAPI }

export interface RunOptions {
  querySelector?: string
  nodes?: ArrayLike<HTMLElement>
}

const contentLoaded = () => {
  merjong.run()
}

if (typeof document !== "undefined") {
  // ! Wait for document loaded before starting the execution
  window.addEventListener("load", contentLoaded, false)
}

const runThrowsErrors = async ({ querySelector = ".merjong", nodes }: RunOptions = {}) => {
  let nodesToProcess: ArrayLike<HTMLElement>

  if (nodes) {
    nodesToProcess = nodes
  } else if (querySelector) {
    nodesToProcess = document.querySelectorAll(querySelector)
  } else {
    throw new Error("Nodes and querySelector are both undefined")
  }

  for (const element of Array.from(nodesToProcess)) {
    if (element.dataset.processed) continue

    const mpsz = element.innerHTML.trim()
    element.innerHTML = await merjongAPI.render(mpsz)
    element.dataset.processed = "true"
  }
}

const run = async (options: RunOptions = { querySelector: ".merjong" }) => {
  await runThrowsErrors(options)
}

const merjong = {
  run
}

export default merjong
