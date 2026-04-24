function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6D2B79F5
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const speciesPresets = [
  { id: 'microbe', name: '原初微生体', tier: 0, role: '低级生命 / 环境塑造', color: '#b7ffd8', traits: { speed: 18, camouflage: 72, fertility: 92, metabolism: 18, resistance: 64, aggression: 4 } },
  { id: 'parasite', name: '寄生微型体', tier: 1, role: '高扩散 / 高环境依赖', color: '#d7a9ff', traits: { speed: 26, camouflage: 68, fertility: 82, metabolism: 40, resistance: 30, aggression: 22 } },
  { id: 'grazer', name: '草食敏捷体', tier: 2, role: '资源采食 / 快速繁殖', color: '#9df2b1', traits: { speed: 62, camouflage: 38, fertility: 76, metabolism: 58, resistance: 42, aggression: 18 } },
  { id: 'scavenger', name: '杂食机会体', tier: 2, role: '环境波动适应 / 泛化生存', color: '#7cc8ff', traits: { speed: 48, camouflage: 44, fertility: 58, metabolism: 46, resistance: 60, aggression: 36 } },
  { id: 'predator', name: '中型捕食体', tier: 3, role: '捕猎压制 / 低繁殖', color: '#ffb37c', traits: { speed: 70, camouflage: 34, fertility: 32, metabolism: 72, resistance: 55, aggression: 84 } }
]

const WORLD_WIDTH = 900
const WORLD_HEIGHT = 520

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function mutateTrait(value, delta) {
  return clamp(value + delta, 1, 99)
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function varyTraits(random, traits, amount = 6) {
  const next = { ...traits }
  for (const key of Object.keys(next)) {
    next[key] = mutateTrait(next[key], Math.round((random() - 0.5) * amount * 2))
  }
  return next
}

function createAgents(random, count, x, y) {
  return Array.from({ length: count }, () => ({
    x: x + (random() - 0.5) * 70,
    y: y + (random() - 0.5) * 70,
    vx: (random() - 0.5) * 1.4,
    vy: (random() - 0.5) * 1.4,
    age: Math.floor(random() * 40),
    lifespan: 280 + Math.floor(random() * 280),
    energy: 85 + random() * 40,
    hunger: random() * 10,
    reproductionCD: 0
  }))
}

function averagePosition(agents) {
  if (!agents || agents.length === 0) return { x: 0, y: 0 }
  const sum = agents.reduce((acc, agent) => {
    acc.x += agent.x
    acc.y += agent.y
    return acc
  }, { x: 0, y: 0 })
  return { x: sum.x / agents.length, y: sum.y / agents.length }
}

function shiftColor(hex, delta) {
  const raw = hex.replace('#', '')
  const num = parseInt(raw, 16)
  const r = clamp(((num >> 16) & 255) + delta, 0, 255)
  const g = clamp(((num >> 8) & 255) + delta / 2, 0, 255)
  const b = clamp((num & 255) - delta / 3, 0, 255)
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
}

function cellIndex(env, x, y) {
  return y * env.fieldWidth + x
}

function createField(env, fill) {
  const field = new Float32Array(env.fieldWidth * env.fieldHeight)
  for (let y = 0; y < env.fieldHeight; y += 1) {
    for (let x = 0; x < env.fieldWidth; x += 1) {
      field[cellIndex(env, x, y)] = fill(x, y)
    }
  }
  return field
}

function createFields(env, random) {
  const w = env.fieldWidth
  const h = env.fieldHeight
  env.fields = {
    flora: createField(env, (x, y) => 34 + 34 * Math.sin((x / w) * Math.PI) + 16 * (1 - y / h) + random() * 10),
    humidity: createField(env, (x) => 38 + 42 * (1 - Math.abs(x / w - 0.2)) + random() * 8),
    temperature: createField(env, (x) => 30 + 35 * (x / w) + random() * 6),
    spores: createField(env, (x, y) => 8 + 12 * (x / w) * (1 - y / h) + random() * 4),
    carrion: createField(env, () => 2 + random() * 2),
    hazard: createField(env, (x) => 8 + 10 * (x / w) + random() * 4),
    complexity: createField(env, () => 4 + random() * 4)
  }
}

function fieldPosToCell(env, x, y) {
  const fx = clamp(Math.floor((x / WORLD_WIDTH) * env.fieldWidth), 0, env.fieldWidth - 1)
  const fy = clamp(Math.floor((y / WORLD_HEIGHT) * env.fieldHeight), 0, env.fieldHeight - 1)
  return { fx, fy, index: cellIndex(env, fx, fy) }
}

function sampleField(env, x, y) {
  const { index } = fieldPosToCell(env, x, y)
  return {
    flora: env.fields.flora[index] || 0,
    humidity: env.fields.humidity[index] || 0,
    temperature: env.fields.temperature[index] || 0,
    spores: env.fields.spores[index] || 0,
    carrion: env.fields.carrion[index] || 0,
    hazard: env.fields.hazard[index] || 0,
    complexity: env.fields.complexity[index] || 0
  }
}

function injectField(env, x, y, key, amount, radius = 1) {
  const field = env.fields[key]
  if (!field) return
  const { fx, fy } = fieldPosToCell(env, x, y)
  for (let yy = Math.max(0, fy - radius); yy <= Math.min(env.fieldHeight - 1, fy + radius); yy += 1) {
    for (let xx = Math.max(0, fx - radius); xx <= Math.min(env.fieldWidth - 1, fx + radius); xx += 1) {
      const distance = Math.hypot(xx - fx, yy - fy)
      const weight = Math.max(0, 1 - distance / (radius + 0.001))
      const i = cellIndex(env, xx, yy)
      field[i] = clamp(field[i] + amount * weight, 0, 160)
    }
  }
}

function diffuseField(env, key, decay = 0.985, diffusion = 0.08, maxValue = 160) {
  const source = env.fields[key]
  if (!source) return
  const output = new Float32Array(source.length)
  for (let y = 0; y < env.fieldHeight; y += 1) {
    for (let x = 0; x < env.fieldWidth; x += 1) {
      let sum = 0
      let count = 0
      for (let yy = Math.max(0, y - 1); yy <= Math.min(env.fieldHeight - 1, y + 1); yy += 1) {
        for (let xx = Math.max(0, x - 1); xx <= Math.min(env.fieldWidth - 1, x + 1); xx += 1) {
          sum += source[cellIndex(env, xx, yy)]
          count += 1
        }
      }
      const i = cellIndex(env, x, y)
      output[i] = clamp(source[i] * decay * (1 - diffusion) + (sum / count) * diffusion, 0, maxValue)
    }
  }
  env.fields[key] = output
}

function averageField(field) {
  return field.reduce((sum, value) => sum + value, 0) / Math.max(1, field.length)
}

function biomeLabel(env) {
  if (env.complexity > 85 && env.resourcePools.flora > 70) return '高复杂生态网'
  if (env.resourcePools.spores > 45 && env.hazard > 26) return '孢子沼泽'
  if (env.resourcePools.flora > 95 && env.humidity > 65) return '繁茂雨林'
  if (env.temperature > 75 && env.humidity < 25) return '荒漠热浪'
  if (env.hazard > 30 && env.temperature > 65) return '灼热裂谷'
  return '原始演替带'
}

function recomputeGlobalFromFields(env) {
  env.resourcePools.flora = averageField(env.fields.flora)
  env.resourcePools.carrion = averageField(env.fields.carrion)
  env.resourcePools.spores = averageField(env.fields.spores)
  env.humidity = averageField(env.fields.humidity)
  env.temperature = averageField(env.fields.temperature)
  env.hazard = averageField(env.fields.hazard)
  env.complexity = averageField(env.fields.complexity)
  env.resources = env.resourcePools.flora
  env.mutationRate = clamp(0.04 + env.hazard / 260 + Math.max(0, 65 - env.resources) / 620 + env.complexity / 900, 0.04, 0.3)
  env.biomeLabel = biomeLabel(env)
}

export function getSpeciesPresets() {
  return speciesPresets
}

export function createInitialWorld({ seed = 42, climateMode = 'temperate' }) {
  const random = mulberry32(seed)
  const climateLabelMap = { temperate: '温和', drought: '干旱', cold: '寒冷', volatile: '剧烈波动' }
  const environment = {
    climateMode,
    climateLabel: climateLabelMap[climateMode] || '温和',
    biomeLabel: '原始演替带',
    fieldWidth: 18,
    fieldHeight: 10,
    temperature: 52,
    humidity: 58,
    resources: 80,
    hazard: 12,
    complexity: 2,
    mutationRate: 0.08,
    resourcePools: { flora: 70, carrion: 4, spores: 10 }
  }
  createFields(environment, random)
  recomputeGlobalFromFields(environment)

  const world = {
    seed,
    random,
    tick: 0,
    splitCounter: 0,
    lastSplitTick: -999,
    environment,
    species: speciesPresets.map((preset, index) => {
      const x = 120 + index * 165
      const y = 140 + index * 62
      const traits = varyTraits(random, preset.traits, 6)
      const population = preset.tier === 0 ? 96 : preset.tier === 1 ? 58 : preset.tier === 3 ? 44 : 62
      return {
        ...clone(preset),
        traits,
        lineage: preset.id,
        population,
        x,
        y,
        vx: (random() - 0.5) * 2,
        vy: (random() - 0.5) * 2,
        targetX: x,
        targetY: y,
        lastSplitTick: -999,
        splitProgress: 0,
        extinct: false,
        agents: createAgents(random, clamp(Math.round(population / 8), 3, 22), x, y)
      }
    }),
    history: []
  }

  recordHistory(world)
  return world
}

function recordHistory(world) {
  world.history.push({
    tick: world.tick,
    species: world.species.map(species => ({
      id: species.id,
      name: species.name,
      population: species.population,
      color: species.color
    }))
  })
  if (world.history.length > 80) world.history.shift()
}

function findLiving(world, id) {
  return world.species.find(species => species.id === id && !species.extinct)
}

function lifeMass(world, tier) {
  return world.species
    .filter(species => !species.extinct && species.tier === tier)
    .reduce((sum, species) => sum + species.population, 0)
}

function updateEnvironment(world) {
  const env = world.environment
  const drift = (field, amount) => {
    for (let i = 0; i < field.length; i += 1) {
      field[i] = clamp(field[i] + amount * (world.random() - 0.5), 0, 160)
    }
  }

  drift(env.fields.temperature, env.climateMode === 'volatile' ? 6 : 2)
  drift(env.fields.humidity, 2)

  for (let y = 0; y < env.fieldHeight; y += 1) {
    for (let x = 0; x < env.fieldWidth; x += 1) {
      const i = cellIndex(env, x, y)
      env.fields.temperature[i] = clamp(env.fields.temperature[i] + (x / env.fieldWidth - 0.5) * 1.2, 0, 160)
      env.fields.humidity[i] = clamp(env.fields.humidity[i] + (0.5 - Math.abs(x / env.fieldWidth - 0.2)) * 0.6, 0, 160)
      env.fields.flora[i] = clamp(env.fields.flora[i] + env.fields.humidity[i] / 120 - env.fields.temperature[i] / 145 - env.fields.hazard[i] / 210 + env.fields.complexity[i] / 220, 0, 160)
      env.fields.spores[i] = clamp(env.fields.spores[i] * 0.993 + env.fields.carrion[i] * 0.012 + world.random() * 0.18, 0, 160)
      env.fields.carrion[i] = clamp(env.fields.carrion[i] * 0.988, 0, 160)
      env.fields.hazard[i] = clamp(env.fields.hazard[i] + env.fields.spores[i] * 0.0025 - env.fields.complexity[i] * 0.0012, 0, 160)
      env.fields.complexity[i] = clamp(env.fields.complexity[i] * 0.998 + env.fields.flora[i] * 0.0026 + env.fields.humidity[i] * 0.0018 - env.fields.hazard[i] * 0.0018, 0, 160)
    }
  }

  diffuseField(env, 'flora', 0.996, 0.10)
  diffuseField(env, 'humidity', 0.998, 0.08)
  diffuseField(env, 'temperature', 0.999, 0.05)
  diffuseField(env, 'spores', 0.994, 0.16)
  diffuseField(env, 'carrion', 0.988, 0.12)
  diffuseField(env, 'hazard', 0.995, 0.10)
  diffuseField(env, 'complexity', 0.999, 0.08)

  recomputeGlobalFromFields(env)
  return `Tick ${world.tick}: ${env.biomeLabel}｜气温 ${env.temperature.toFixed(0)}，湿度 ${env.humidity.toFixed(0)}，植物 ${env.resourcePools.flora.toFixed(0)}，残骸 ${env.resourcePools.carrion.toFixed(0)}，孢子 ${env.resourcePools.spores.toFixed(0)}，复杂度 ${env.complexity.toFixed(0)}`
}

function applyEcologyFeedback(world) {
  const env = world.environment
  for (const species of world.species) {
    if (species.extinct) continue
    if (species.tier === 0) {
      injectField(env, species.x, species.y, 'spores', 0.12, 1)
      injectField(env, species.x, species.y, 'complexity', 0.55, 1)
      injectField(env, species.x, species.y, 'flora', 0.18, 1)
    } else if (species.tier === 1) {
      injectField(env, species.x, species.y, 'spores', 0.32, 1)
      injectField(env, species.x, species.y, 'complexity', 0.42, 1)
      injectField(env, species.x, species.y, 'hazard', 0.06, 1)
    } else if (species.tier === 2) {
      injectField(env, species.x, species.y, 'flora', -0.50, 1)
      injectField(env, species.x, species.y, 'complexity', 0.28, 1)
    } else if (species.tier >= 3) {
      injectField(env, species.x, species.y, 'carrion', 0.22, 1)
      injectField(env, species.x, species.y, 'hazard', 0.08, 1)
      injectField(env, species.x, species.y, 'complexity', 0.22, 1)
    }
  }

  diffuseField(env, 'flora', 0.997, 0.08)
  diffuseField(env, 'spores', 0.994, 0.14)
  diffuseField(env, 'carrion', 0.988, 0.10)
  diffuseField(env, 'hazard', 0.995, 0.08)
  diffuseField(env, 'complexity', 0.999, 0.10)
  recomputeGlobalFromFields(env)

  return `生态反馈：L0 ${lifeMass(world, 0)} / L1 ${lifeMass(world, 1)} / L2 ${lifeMass(world, 2)} / L3 ${lifeMass(world, 3)} / 复杂度 ${env.complexity.toFixed(0)}。`
}

function applyStrategies(world, strategyProvider) {
  const narratives = []
  for (const species of world.species) {
    if (species.extinct) continue
    const strategy = strategyProvider.getStrategy({ world, species }) || { mutationBias: {}, narrative: '维持当前生态位。' }
    for (const key of Object.keys(strategy.mutationBias || {})) {
      species.traits[key] = mutateTrait(species.traits[key], strategy.mutationBias[key])
    }
    narratives.push(`L${species.tier} ${species.name}：${strategy.narrative || '维持当前生态位。'}`)
  }
  return narratives
}

function applyMutation(world, species) {
  const logs = []
  if (world.random() < world.environment.mutationRate) {
    const keys = ['speed', 'camouflage', 'fertility', 'metabolism', 'resistance', 'aggression']
    const key = keys[Math.floor(world.random() * keys.length)]
    const delta = world.random() < 0.5 ? -2 : 2
    species.traits[key] = mutateTrait(species.traits[key], delta)
    logs.push(`突变：L${species.tier} ${species.name} 的 ${key} ${delta > 0 ? '增强' : '减弱'}。`)
  }
  return logs
}

function updateBoids(species, targetX, targetY) {
  const maxSpeed = Math.max(0.5, species.traits.speed / 30)
  for (let i = 0; i < species.agents.length; i += 1) {
    const agent = species.agents[i]
    let alignX = 0
    let alignY = 0
    let cohesionX = 0
    let cohesionY = 0
    let separateX = 0
    let separateY = 0
    let count = 0

    for (let j = 0; j < species.agents.length; j += 1) {
      if (i === j) continue
      const other = species.agents[j]
      const dx = other.x - agent.x
      const dy = other.y - agent.y
      const distance = Math.hypot(dx, dy)
      if (distance < 80) {
        alignX += other.vx
        alignY += other.vy
        cohesionX += other.x
        cohesionY += other.y
        count += 1
        if (distance < 20) {
          separateX -= dx / (distance || 1)
          separateY -= dy / (distance || 1)
        }
      }
    }

    if (count > 0) {
      alignX /= count
      alignY /= count
      cohesionX = cohesionX / count - agent.x
      cohesionY = cohesionY / count - agent.y
      agent.vx += alignX * 0.05 + cohesionX * 0.003 + separateX * 0.06
      agent.vy += alignY * 0.05 + cohesionY * 0.003 + separateY * 0.06
    }

    agent.vx += (targetX - agent.x) * 0.003
    agent.vy += (targetY - agent.y) * 0.003
    const speed = Math.hypot(agent.vx, agent.vy) || 1
    if (speed > maxSpeed) {
      agent.vx = (agent.vx / speed) * maxSpeed
      agent.vy = (agent.vy / speed) * maxSpeed
    }
    agent.x = clamp(agent.x + agent.vx, 36, 864)
    agent.y = clamp(agent.y + agent.vy, 36, 484)
  }
}

function markExtinct(species) {
  species.population = 0
  species.extinct = true
  species.agents = []
  species.vx = 0
  species.vy = 0
}

function syncAgentCount(world, species) {
  if (species.extinct || species.population <= 0) {
    markExtinct(species)
    return
  }
  const desired = clamp(Math.round(species.population / 8), 2, 22)
  while (species.agents.length < desired) species.agents.push(...createAgents(world.random, 1, species.x, species.y))
  while (species.agents.length > desired) species.agents.pop()
}

function removeAgents(species, count) {
  for (let i = 0; i < count && species.agents.length > 0; i += 1) {
    species.agents.splice(Math.floor(Math.random() * species.agents.length), 1)
  }
  if (species.agents.length === 0) markExtinct(species)
}

function resolveGameInteractions(world) {
  const logs = []
  const predator = findLiving(world, 'predator')
  const grazer = findLiving(world, 'grazer')
  if (predator && grazer) {
    const distance = Math.hypot(predator.x - grazer.x, predator.y - grazer.y)
    const packBonus = Math.max(0, predator.agents.length - 6) * 0.12
    const defense = Math.max(0, grazer.agents.length - 8) * 0.08
    if (distance < 110 && predator.traits.aggression / 100 + packBonus > 0.48 - defense) {
      const kills = clamp(Math.round(1 + predator.traits.aggression / 35 + packBonus - defense), 1, 4)
      grazer.population = clamp(grazer.population - kills, 0, 240)
      removeAgents(grazer, kills)
      predator.population = clamp(predator.population + Math.max(1, Math.round(kills * 0.5)), 0, 240)
      injectField(world.environment, predator.x, predator.y, 'carrion', kills * 4, 1)
      logs.push(`围猎事件：L3 ${predator.name} 围猎 L2 ${grazer.name}，击杀 ${kills} 个体。`)
    }
  }
  return logs
}

function scoreTarget(world, species, x, y, cellIndexValue) {
  const env = world.environment
  const predator = findLiving(world, 'predator')
  const grazer = findLiving(world, 'grazer')
  const distance = Math.hypot(x - species.x, y - species.y)
  let score = -distance * 0.03

  if (species.tier === 0) {
    score += env.fields.humidity[cellIndexValue] * 0.7 + env.fields.flora[cellIndexValue] * 0.4 - env.fields.hazard[cellIndexValue] * 0.2
  } else if (species.tier === 1) {
    score += env.fields.spores[cellIndexValue] * 1.1 + env.fields.complexity[cellIndexValue] * 0.3
  } else if (species.lineage === 'grazer') {
    score += env.fields.flora[cellIndexValue] * 1.2 - env.fields.spores[cellIndexValue] * 0.4 - env.fields.hazard[cellIndexValue] * 0.5
    if (predator) score -= Math.max(0, 140 - Math.hypot(x - predator.x, y - predator.y)) * 0.02
  } else if (species.lineage === 'predator') {
    if (grazer) score -= Math.hypot(x - grazer.x, y - grazer.y) * 0.08
    score += env.fields.carrion[cellIndexValue] * 0.2
  } else {
    score += env.fields.carrion[cellIndexValue] * 0.8 + env.fields.complexity[cellIndexValue] * 0.3
  }
  return score
}

function chooseTarget(world, species) {
  const env = world.environment
  let best = { score: -Infinity, x: species.x, y: species.y }
  for (let gy = 0; gy < env.fieldHeight; gy += 1) {
    for (let gx = 0; gx < env.fieldWidth; gx += 1) {
      const i = cellIndex(env, gx, gy)
      const x = ((gx + 0.5) / env.fieldWidth) * WORLD_WIDTH
      const y = ((gy + 0.5) / env.fieldHeight) * WORLD_HEIGHT
      const score = scoreTarget(world, species, x, y, i)
      if (score > best.score) best = { score, x, y }
    }
  }
  return best
}

function moveSpecies(world, species) {
  if (species.extinct || species.population <= 0 || !species.agents || species.agents.length === 0) return
  const target = chooseTarget(world, species)
  species.targetX = clamp(target.x + (world.random() - 0.5) * 16, 60, 840)
  species.targetY = clamp(target.y + (world.random() - 0.5) * 16, 60, 460)
  updateBoids(species, species.targetX, species.targetY)
  const center = averagePosition(species.agents)
  species.vx = (center.x - species.x) * 0.2
  species.vy = (center.y - species.y) * 0.2
  species.x = center.x
  species.y = center.y
}

function resolvePopulation(world) {
  const env = world.environment
  const predator = findLiving(world, 'predator')
  const logs = []

  for (const species of world.species) {
    if (species.extinct) continue
    let deaths = 0
    for (const agent of species.agents) {
      const local = sampleField(env, agent.x, agent.y)
      agent.age += 1
      agent.hunger += species.traits.metabolism / 42
      agent.energy -= species.traits.metabolism / 62
      agent.energy += (local.flora + local.spores + local.carrion + local.complexity) / 520
      if (agent.age > agent.lifespan || agent.energy <= 0 || agent.hunger > 160 || local.hazard > 130) deaths += 1
    }

    if (deaths > 0) {
      removeAgents(species, deaths)
      species.population = clamp(species.population - deaths, 0, 240)
      logs.push(`L${species.tier} ${species.name}：${deaths} 个体因老化、饥饿或局部环境恶化死亡。`)
    }

    const local = sampleField(env, species.x, species.y)
    let preferred = local.complexity * 0.025
    if (species.tier === 0) preferred += local.humidity * 0.04 + local.flora * 0.035
    else if (species.tier === 1) preferred += local.spores * 0.07 + local.complexity * 0.035
    else if (species.lineage === 'grazer') preferred += local.flora * 0.07
    else if (species.lineage === 'predator') preferred += local.carrion * 0.05 + 1.1
    else preferred += local.carrion * 0.05 + local.flora * 0.02

    const crowdPenalty = Math.max(0, species.agents.length - 11) * 0.14
    const fertilityGain = species.traits.fertility / 32
    const temperatureStress = Math.abs(local.temperature - 50) / 28
    const droughtStress = local.humidity < 22 ? (70 - species.traits.resistance) / 36 : 0
    const hazardStress = local.hazard / 40 - species.traits.resistance / 52
    let predationStress = 0
    if (species.lineage !== 'predator' && predator) {
      const proximity = 1 / Math.max(1, Math.hypot(predator.x - species.x, predator.y - species.y) / 120)
      predationStress = species.tier < 2 ? 0 : proximity * (predator.population / 280) - (species.traits.speed + species.traits.camouflage) / 260
    }

    const delta = preferred + fertilityGain - temperatureStress - droughtStress - hazardStress - predationStress - crowdPenalty
    species.population = clamp(Math.round(species.population + delta), 0, 240)
    logs.push(...applyMutation(world, species))
    syncAgentCount(world, species)
    moveSpecies(world, species)
  }

  recomputeGlobalFromFields(env)
  return logs
}

function maybeSplitSpecies(world) {
  const logs = []
  const newborn = []
  const livingCount = world.species.filter(species => !species.extinct).length
  if (livingCount >= 9 || world.tick - world.lastSplitTick < 24) return logs

  for (const species of world.species) {
    if (species.extinct) continue
    if (livingCount + newborn.length >= 9) break
    const local = sampleField(world.environment, species.x, species.y)
    const divergence = Math.max(
      Math.abs(species.traits.speed - 50),
      Math.abs(species.traits.camouflage - 50),
      Math.abs(species.traits.resistance - 50),
      Math.abs(species.traits.aggression - 50)
    )
    species.splitProgress = (species.splitProgress || 0) + (
      (species.population > 125 ? 1.2 : 0) +
      (local.hazard > 28 ? 1 : 0) +
      (local.flora < 36 ? 1 : 0) +
      (divergence > 24 ? 1 : 0)
    ) * 0.55

    if (species.population > 145 && species.splitProgress > 18 && world.tick - species.lastSplitTick > 44) {
      world.splitCounter += 1
      const childId = `${species.id}_split_${world.splitCounter}`
      const childName = `${species.name}·分支${world.splitCounter}`
      const populationShare = Math.max(12, Math.round(species.population * 0.12))
      species.population = clamp(species.population - populationShare, 0, 240)
      species.lastSplitTick = world.tick
      species.splitProgress = 0
      world.lastSplitTick = world.tick
      const childTraits = varyTraits(world.random, species.traits, 10)
      const x = clamp(species.x + (world.random() - 0.5) * 120, 80, 820)
      const y = clamp(species.y + (world.random() - 0.5) * 120, 80, 440)
      newborn.push({
        id: childId,
        lineage: species.lineage || species.id,
        name: childName,
        role: `${species.role} / 谱系分裂`,
        tier: species.tier,
        color: shiftColor(species.color, world.random() < 0.5 ? -18 : 18),
        traits: childTraits,
        population: populationShare,
        x,
        y,
        vx: (world.random() - 0.5) * 2,
        vy: (world.random() - 0.5) * 2,
        targetX: x,
        targetY: y,
        lastSplitTick: world.tick,
        splitProgress: 0,
        extinct: false,
        agents: createAgents(world.random, clamp(Math.round(populationShare / 8), 2, 22), x, y)
      })
      logs.push(`物种分裂：L${species.tier} ${species.name} 分化出 ${childName}。`)
    }
  }

  if (newborn.length > 0) world.species.push(...newborn)
  return logs
}

function maybeEnvironmentSpawn(world) {
  const logs = []
  const env = world.environment
  if (world.species.filter(species => !species.extinct).length >= 10) return logs
  if (world.tick - world.lastSplitTick < 18) return logs

  const bases = {
    0: speciesPresets[0],
    1: speciesPresets[1],
    2: speciesPresets[2],
    3: speciesPresets[4]
  }
  const names = ['原生膜质体', '孢子游走体', '环境适应体', '高阶掠食体']
  const colors = ['#b7ffd8', '#d7a9ff', '#9df2b1', '#ffb37c']

  for (let y = 0; y < env.fieldHeight; y += 1) {
    for (let x = 0; x < env.fieldWidth; x += 1) {
      const i = cellIndex(env, x, y)
      let tier = null
      if (env.fields.humidity[i] > 42 && env.fields.flora[i] > 24 && world.random() < 0.0015) tier = 0
      if (tier === null && lifeMass(world, 0) > 70 && env.fields.spores[i] > 24 && env.fields.complexity[i] > 18 && world.random() < 0.0012) tier = 1
      if (tier === null && lifeMass(world, 1) > 35 && env.fields.flora[i] > 45 && env.fields.complexity[i] > 36 && world.random() < 0.001) tier = 2
      if (tier === null && lifeMass(world, 2) > 60 && env.fields.carrion[i] > 8 && env.fields.complexity[i] > 52 && world.random() < 0.0008) tier = 3
      if (tier === null) continue

      world.splitCounter += 1
      const px = ((x + 0.5) / env.fieldWidth) * WORLD_WIDTH
      const py = ((y + 0.5) / env.fieldHeight) * WORLD_HEIGHT
      const base = bases[tier] || speciesPresets[0]
      const traits = varyTraits(world.random, base.traits, 14)
      world.species.push({
        id: `envborn_${world.splitCounter}`,
        lineage: base.id,
        name: `${names[tier]}${world.splitCounter}`,
        role: `环境孕育 / L${tier} 新生物`,
        tier,
        color: shiftColor(colors[tier], Math.round((world.random() - 0.5) * 36)),
        traits,
        population: tier === 0 ? 36 : 18,
        x: px,
        y: py,
        vx: (world.random() - 0.5) * 2,
        vy: (world.random() - 0.5) * 2,
        targetX: px,
        targetY: py,
        lastSplitTick: world.tick,
        splitProgress: 0,
        extinct: false,
        agents: createAgents(world.random, tier === 0 ? 7 : 4, px, py)
      })
      world.lastSplitTick = world.tick
      logs.push(`环境孕育：局部环境先后演替，诞生 L${tier} ${names[tier]}${world.splitCounter}。`)
      return logs
    }
  }

  return logs
}

export function stepWorld(world, strategyProvider) {
  world.tick += 1
  const environmentNarrativeBase = updateEnvironment(world)
  const ecologyNarrative = applyEcologyFeedback(world)
  const speciesNarratives = []
  speciesNarratives.push(...applyStrategies(world, strategyProvider))
  speciesNarratives.push(...resolveGameInteractions(world))
  speciesNarratives.push(...resolvePopulation(world))
  speciesNarratives.push(...maybeSplitSpecies(world))
  speciesNarratives.push(...maybeEnvironmentSpawn(world))
  recordHistory(world)
  return { environmentNarrative: `${environmentNarrativeBase}；${ecologyNarrative}`, speciesNarratives }
}
