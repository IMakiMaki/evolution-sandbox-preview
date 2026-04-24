import { createInitialWorld, getSpeciesPresets, stepWorld } from './simulation.js'
import { drawTrend, drawWorld } from './render.js'
import { createMockStrategyProvider, createRuleStrategyProvider } from './strategy.js'

const canvas = document.getElementById('worldCanvas')
const trendCanvas = document.getElementById('trendCanvas')
const tickEl = document.getElementById('tickValue')
const climateEl = document.getElementById('climateValue')
const resourceEl = document.getElementById('resourceValue')
const worldSummaryEl = document.getElementById('worldSummary')
const runBtn = document.getElementById('runBtn')
const pauseBtn = document.getElementById('pauseBtn')
const initBtn = document.getElementById('initBtn')
const stepBtn = document.getElementById('stepBtn')
const seedInput = document.getElementById('seedInput')
const climateSelect = document.getElementById('climateSelect')
const speedRange = document.getElementById('speedRange')
const useMockLlm = document.getElementById('useMockLlm')
const speciesEditor = document.getElementById('speciesEditor')
const envLog = document.getElementById('envLog')
const speciesLog = document.getElementById('speciesLog')

let running = false
let lastSim = 0
let world = createWorldFromControls()

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function average(field) {
  return field.reduce((sum, value) => sum + value, 0) / Math.max(1, field.length)
}

function applyClimatePreset(world) {
  const env = world.environment
  const fields = env.fields
  const mode = env.climateMode

  for (let y = 0; y < env.fieldHeight; y += 1) {
    for (let x = 0; x < env.fieldWidth; x += 1) {
      const i = y * env.fieldWidth + x
      const east = x / Math.max(1, env.fieldWidth - 1)
      const north = 1 - y / Math.max(1, env.fieldHeight - 1)

      if (mode === 'drought') {
        fields.humidity[i] = clamp(fields.humidity[i] * 0.42, 0, 160)
        fields.temperature[i] = clamp(78 + east * 22 + Math.random() * 5, 0, 160)
        fields.flora[i] = clamp(fields.flora[i] * 0.38, 0, 160)
        fields.hazard[i] = clamp(fields.hazard[i] + 16 + east * 12, 0, 160)
        fields.spores[i] = clamp(fields.spores[i] * 0.65, 0, 160)
      } else if (mode === 'cold') {
        fields.temperature[i] = clamp(14 + east * 14 + Math.random() * 4, 0, 160)
        fields.humidity[i] = clamp(fields.humidity[i] * 0.85 + north * 12, 0, 160)
        fields.flora[i] = clamp(fields.flora[i] * 0.58, 0, 160)
        fields.hazard[i] = clamp(fields.hazard[i] + 4, 0, 160)
        fields.spores[i] = clamp(fields.spores[i] * 0.5, 0, 160)
      } else if (mode === 'volatile') {
        fields.temperature[i] = clamp(28 + Math.random() * 82, 0, 160)
        fields.humidity[i] = clamp(18 + Math.random() * 92, 0, 160)
        fields.flora[i] = clamp(18 + Math.random() * 110, 0, 160)
        fields.hazard[i] = clamp(14 + Math.random() * 48, 0, 160)
        fields.spores[i] = clamp(8 + Math.random() * 46, 0, 160)
        fields.carrion[i] = clamp(fields.carrion[i] + Math.random() * 8, 0, 160)
      }
    }
  }

  env.resourcePools.flora = average(fields.flora)
  env.resourcePools.carrion = average(fields.carrion)
  env.resourcePools.spores = average(fields.spores)
  env.humidity = average(fields.humidity)
  env.temperature = average(fields.temperature)
  env.hazard = average(fields.hazard)
  env.resources = env.resourcePools.flora
}

function createWorldFromControls() {
  const seed = Number(seedInput?.value || 42)
  const climateMode = climateSelect?.value || 'temperate'
  const nextWorld = createInitialWorld({ seed, climateMode })
  applyClimatePreset(nextWorld)
  return nextWorld
}

function currentProvider() {
  return useMockLlm?.checked ? createMockStrategyProvider() : createRuleStrategyProvider()
}

function currentInterval() {
  const slider = Number(speedRange?.value || 700)
  return clamp(1800 - slider, 80, 1600)
}

function pushLog(container, text) {
  if (!container || !text) return
  const item = document.createElement('div')
  item.className = 'log-item'
  item.textContent = text
  container.prepend(item)
  while (container.children.length > 40) container.removeChild(container.lastChild)
}

function clearLogs() {
  envLog.innerHTML = ''
  speciesLog.innerHTML = ''
}

function renderSpeciesEditor() {
  if (!speciesEditor) return
  const presets = getSpeciesPresets()
  speciesEditor.innerHTML = presets.map(species => `
    <div class="species-pill">
      <span style="background:${species.color}"></span>
      <div>
        <strong>L${species.tier} ${species.name}</strong>
        <small>${species.role}</small>
      </div>
    </div>
  `).join('')
}

function updateHud() {
  const env = world.environment
  tickEl.textContent = world.tick
  climateEl.textContent = `${env.climateLabel} / ${env.biomeLabel}`
  resourceEl.textContent = `${Math.round(env.resources)}`
  if (worldSummaryEl) {
    const living = world.species.filter(species => !species.extinct && species.population > 0).length
    worldSummaryEl.textContent = `存活物种 ${living}｜植物 ${env.resourcePools.flora.toFixed(0)}｜孢子 ${env.resourcePools.spores.toFixed(0)}｜复杂度 ${env.complexity?.toFixed?.(0) ?? '-'}｜速度 ${currentInterval()}ms/步`
  }
}

function renderAll() {
  updateHud()
  drawWorld(canvas, world)
  drawTrend(trendCanvas, world.history)
}

function stepOnce() {
  const result = stepWorld(world, currentProvider())
  pushLog(envLog, result.environmentNarrative)
  for (const item of result.speciesNarratives) pushLog(speciesLog, item)
  renderAll()
}

function loop(timestamp) {
  if (!running) return
  requestAnimationFrame(loop)
  if (timestamp - lastSim < currentInterval()) return
  lastSim = timestamp
  stepOnce()
}

function resetWorld() {
  running = false
  world = createWorldFromControls()
  lastSim = 0
  clearLogs()
  pushLog(envLog, `初始化世界：种子 ${seedInput.value || 42}，气候 ${climateSelect.options[climateSelect.selectedIndex]?.text || climateSelect.value}。`)
  renderAll()
}

initBtn.onclick = resetWorld
stepBtn.onclick = () => {
  running = false
  stepOnce()
}
runBtn.onclick = () => {
  if (!running) {
    running = true
    lastSim = 0
    requestAnimationFrame(loop)
  }
}
pauseBtn.onclick = () => {
  running = false
}
climateSelect.onchange = resetWorld
seedInput.onchange = resetWorld
speedRange.oninput = renderAll
useMockLlm.onchange = () => {
  pushLog(speciesLog, useMockLlm.checked ? '切换为 Mock LLM 策略层。' : '切换为规则策略层。')
}

renderSpeciesEditor()
renderAll()
