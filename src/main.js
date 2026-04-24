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
const eventCards = document.getElementById('eventCards')
const speciesDetail = document.getElementById('speciesDetail')

let running = false
let lastSim = 0
let selectedSpeciesId = null
let previousSnapshot = new Map()
let world = createWorldFromControls()

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function average(field) {
  return field.reduce((sum, value) => sum + value, 0) / Math.max(1, field.length)
}

function pseudoNoise(seed, tick, index) {
  const x = Math.sin(seed * 12.9898 + tick * 78.233 + index * 37.719) * 43758.5453
  return x - Math.floor(x)
}

function lineageOf(species) {
  return species?.lineage || species?.id || 'unknown'
}

function phenotypeTags(species) {
  const traits = species?.traits || {}
  const tags = []
  if ((traits.speed || 0) > 65) tags.push('长尾高速')
  if ((traits.aggression || 0) > 62) tags.push('尖刺口器')
  if ((traits.resistance || 0) > 62) tags.push('厚甲')
  if ((traits.camouflage || 0) > 62) tags.push('拟态纹')
  if ((traits.fertility || 0) > 72) tags.push('群聚繁殖')
  if ((traits.metabolism || 0) > 68) tags.push('高代谢')
  if (tags.length === 0) tags.push('基础表型')
  return tags
}

function snapshotWorld(world) {
  previousSnapshot = new Map(world.species.map(species => [species.id, {
    population: species.population,
    traits: { ...species.traits },
    extinct: species.extinct,
    tier: species.tier
  }]))
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

function carryingCapacityFor(species, env) {
  const flora = env.resourcePools?.flora || env.resources || 0
  const spores = env.resourcePools?.spores || 0
  const carrion = env.resourcePools?.carrion || 0
  const complexity = env.complexity || 0
  const hazard = env.hazard || 0

  if (species.tier === 0) return clamp(60 + env.humidity * 1.1 + complexity * 0.35 - hazard * 0.18, 35, 230)
  if (species.tier === 1) return clamp(32 + spores * 1.8 + complexity * 0.55 - hazard * 0.12, 20, 210)
  if (species.lineage === 'grazer') return clamp(30 + flora * 1.65 + env.humidity * 0.2 - hazard * 0.45, 15, 220)
  if (species.lineage === 'predator') return clamp(18 + carrion * 2.4 + complexity * 0.45 + Math.max(0, flora - 45) * 0.1, 8, 155)
  return clamp(24 + carrion * 1.5 + flora * 0.35 + complexity * 0.55 - hazard * 0.2, 12, 200)
}

function intensifyLateGameEvolution(world) {
  if (world.tick < 35) return []
  const messages = []
  const env = world.environment
  const pressure = clamp((env.hazard || 0) / 45 + Math.max(0, 65 - (env.resources || 0)) / 55 + (env.complexity || 0) / 90, 0.2, 3.2)

  for (let index = 0; index < world.species.length; index += 1) {
    const species = world.species[index]
    if (!species || species.extinct || species.population <= 0) continue
    const chance = 0.025 + pressure * 0.018 + (species.tier || 0) * 0.004
    if (pseudoNoise(world.seed, world.tick, index + 401) > chance) continue

    const traitKeys = ['speed', 'camouflage', 'fertility', 'metabolism', 'resistance', 'aggression']
    const key = traitKeys[Math.floor(pseudoNoise(world.seed, world.tick, index + 503) * traitKeys.length)]
    const direction = pseudoNoise(world.seed, world.tick, index + 607) > 0.42 ? 1 : -1
    const amount = Math.round(2 + pressure + pseudoNoise(world.seed, world.tick, index + 701) * 3)
    species.traits[key] = clamp((species.traits[key] || 50) + direction * amount, 1, 99)
    messages.push(`持续选择压力：L${species.tier} ${species.name} 的 ${key} ${direction > 0 ? '+' : '-'}${amount}，表型偏向 ${phenotypeTags(species).join('、')}。`)
  }
  return messages
}

function applyPopulationDynamics(world) {
  const env = world.environment
  const season = Math.sin(world.tick / 17)
  const shockChance = env.climateMode === 'volatile' ? 0.11 : env.climateMode === 'drought' ? 0.07 : 0.035
  const shock = pseudoNoise(world.seed, Math.floor(world.tick / 9), 99) < shockChance
  const shockSign = pseudoNoise(world.seed, world.tick, 111) > 0.62 ? 1 : -1
  const messages = []

  for (let index = 0; index < world.species.length; index += 1) {
    const species = world.species[index]
    if (!species || species.extinct || species.population <= 0) continue

    const previous = species.populationFloat ?? species.population
    const capacity = carryingCapacityFor(species, env)
    const densityPressure = Math.max(0, previous - capacity) * 0.075
    const underCapacityBoost = Math.max(0, capacity - previous) * 0.018
    const seasonalEffect = season * (species.tier === 0 ? 2.4 : species.lineage === 'grazer' ? 2.0 : species.lineage === 'predator' ? -1.2 : 1.4)
    const chaos = (pseudoNoise(world.seed, world.tick, index) - 0.5) * (2.4 + env.hazard / 28)
    const pulse = pseudoNoise(world.seed, Math.floor(world.tick / 5), index + 7) > 0.84 ? 2 + species.traits.fertility / 42 : 0
    const hazardLoss = Math.max(0, env.hazard - species.traits.resistance) * 0.035
    const resourceLoss = species.lineage === 'grazer' ? Math.max(0, 42 - (env.resourcePools?.flora || 0)) * 0.1 : 0
    const shockEffect = shock ? shockSign * (species.tier === 0 ? 2.5 : species.tier === 3 ? 1.3 : 2.0) : 0

    const delta = underCapacityBoost + seasonalEffect + chaos + pulse + shockEffect - densityPressure - hazardLoss - resourceLoss
    species.populationFloat = clamp(previous + delta, 0, 240)
    species.population = Math.round(species.populationFloat)

    if (species.population <= 0) {
      species.extinct = true
      species.agents = []
    }
  }

  const latest = world.history[world.history.length - 1]
  if (latest) {
    latest.species = world.species.map(species => ({
      id: species.id,
      name: species.name,
      population: species.population,
      color: species.color
    }))
  }

  if (shock) messages.push(shockSign > 0 ? '生态扰动：短期资源窗口让部分种群反弹。' : '生态扰动：环境压力造成多种群同步下滑。')
  return messages
}

function classifyEvent(text) {
  if (/分裂|分化/.test(text)) return ['物种分裂', '谱系结构发生改变，新的分支开始独立竞争。']
  if (/环境孕育|诞生/.test(text)) return ['环境孕育', '局部生态场达成条件，新生命从环境中出现。']
  if (/突变|选择压力/.test(text)) return ['表型突变', '基因值发生变化，外形标签和行为倾向可能改变。']
  if (/围猎|击杀|死亡|灭绝/.test(text)) return ['生存事件', '个体死亡或捕食行为改变了种群结构。']
  if (/生态扰动|灾变|压力|冲击/.test(text)) return ['环境扰动', '环境场产生波动，推动种群重新洗牌。']
  return ['演化记录', '系统状态发生了可观察变化。']
}

function pushEventCard(text, speciesId = null) {
  if (!eventCards || !text) return
  const [title, desc] = classifyEvent(text)
  const card = document.createElement('div')
  card.className = 'evo-card'
  card.innerHTML = `
    <strong>${title}</strong>
    <p>${text}</p>
    <div class="evo-meta"><span>Tick ${world.tick}</span><span>${desc}</span></div>
  `
  if (speciesId) card.onclick = () => { selectedSpeciesId = speciesId; renderSpeciesDetail() }
  eventCards.prepend(card)
  while (eventCards.children.length > 18) eventCards.removeChild(eventCards.lastChild)
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
  if (eventCards) eventCards.innerHTML = ''
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

function mostActiveSpecies() {
  let best = world.species.find(species => !species.extinct && species.population > 0)
  let bestScore = -Infinity
  for (const species of world.species) {
    if (!species || species.extinct || species.population <= 0) continue
    const prev = previousSnapshot.get(species.id)
    const populationChange = Math.abs(species.population - (prev?.population ?? species.population))
    const traitChange = Object.entries(species.traits || {}).reduce((sum, [key, value]) => sum + Math.abs(value - (prev?.traits?.[key] ?? value)), 0)
    const score = populationChange * 2 + traitChange + (species.splitProgress || 0) * 0.25 + (species.tier || 0)
    if (score > bestScore) {
      bestScore = score
      best = species
    }
  }
  return best
}

function renderSpeciesDetail() {
  if (!speciesDetail) return
  const species = world.species.find(item => item.id === selectedSpeciesId && !item.extinct) || mostActiveSpecies()
  if (!species) {
    speciesDetail.innerHTML = '<p class="muted">暂无存活物种。</p>'
    return
  }
  selectedSpeciesId = species.id
  const tags = phenotypeTags(species)
  const traits = species.traits || {}
  const rows = Object.entries(traits).map(([key, value]) => `
    <div class="trait-row">
      <span>${key}</span>
      <div class="trait-bar"><span style="width:${clamp(value, 0, 99)}%"></span></div>
      <b>${Math.round(value)}</b>
    </div>
  `).join('')
  speciesDetail.innerHTML = `
    <div class="detail-head">
      <div class="detail-avatar" style="background:${species.color}">L${species.tier}</div>
      <div class="detail-title">
        <strong>${species.name}</strong>
        <span>${species.role || ''}</span>
      </div>
    </div>
    <div class="muted">谱系：${lineageOf(species)} ｜ 种群：${species.population} ｜ 分裂进度：${Math.round(species.splitProgress || 0)}</div>
    <div class="tag-row">${tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>
    <div class="trait-grid">${rows}</div>
  `
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
  renderSpeciesDetail()
  drawWorld(canvas, world)
  drawTrend(trendCanvas, world.history)
}

function stepOnce() {
  snapshotWorld(world)
  const result = stepWorld(world, currentProvider())
  const dynamicsNarratives = applyPopulationDynamics(world)
  const pressureNarratives = intensifyLateGameEvolution(world)
  const allNarratives = [...result.speciesNarratives, ...dynamicsNarratives, ...pressureNarratives]
  pushLog(envLog, result.environmentNarrative)
  for (const item of allNarratives) {
    pushLog(speciesLog, item)
    if (/分裂|分化|环境孕育|诞生|突变|选择压力|生态扰动|围猎|击杀|死亡|灭绝/.test(item)) {
      pushEventCard(item)
    }
  }
  const latest = world.history[world.history.length - 1]
  if (latest) {
    latest.species = world.species.map(species => ({ id: species.id, name: species.name, population: species.population, color: species.color }))
  }
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
  previousSnapshot = new Map()
  selectedSpeciesId = null
  lastSim = 0
  clearLogs()
  pushLog(envLog, `初始化世界：种子 ${seedInput.value || 42}，气候 ${climateSelect.options[climateSelect.selectedIndex]?.text || climateSelect.value}。`)
  pushEventCard('世界初始化：环境场、生命等级和初始生态链已生成。')
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
snapshotWorld(world)
pushEventCard('世界初始化：环境场、生命等级和初始生态链已生成。')
renderAll()
