function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}

const speciesPresets=[
  {id:'grazer',name:'草食敏捷体',role:'资源采食 / 快速繁殖',color:'#9df2b1',traits:{speed:62,camouflage:38,fertility:76,metabolism:58,resistance:42,aggression:18}},
  {id:'predator',name:'中型捕食体',role:'捕猎压制 / 低繁殖',color:'#ffb37c',traits:{speed:70,camouflage:34,fertility:32,metabolism:72,resistance:55,aggression:84}},
  {id:'scavenger',name:'杂食机会体',role:'环境波动适应 / 泛化生存',color:'#7cc8ff',traits:{speed:48,camouflage:44,fertility:58,metabolism:46,resistance:60,aggression:36}},
  {id:'parasite',name:'寄生微型体',role:'高扩散 / 高环境依赖',color:'#d7a9ff',traits:{speed:26,camouflage:68,fertility:82,metabolism:40,resistance:30,aggression:22}}
]

function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
function mutateTrait(value,delta){return clamp(value+delta,1,99)}
function createAgents(r,count,x,y){return Array.from({length:count},()=>({x:x+(r()-.5)*80,y:y+(r()-.5)*80,vx:(r()-.5)*1.4,vy:(r()-.5)*1.4}))}
function avgPos(agents){if(!agents.length)return{x:0,y:0};const s=agents.reduce((a,b)=>{a.x+=b.x;a.y+=b.y;return a},{x:0,y:0});return{x:s.x/agents.length,y:s.y/agents.length}}
function shiftColor(hex,delta){const h=hex.replace('#','');let n=parseInt(h,16);let r=(n>>16)&255,g=(n>>8)&255,b=n&255;r=clamp(r+delta,0,255);g=clamp(g+delta/2,0,255);b=clamp(b-delta/3,0,255);return '#'+[r,g,b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('')}

export function getSpeciesPresets(){return speciesPresets}

export function createInitialWorld({seed,climateMode='temperate'}){
  const random=mulberry32(seed)
  const climateLabelMap={temperate:'温和',drought:'干旱',cold:'寒冷',volatile:'剧烈波动'}
  const world={
    seed,
    random,
    tick:0,
    splitCounter:0,
    lastSplitTick:-999,
    environment:{
      climateMode,
      climateLabel:climateLabelMap[climateMode],
      temperature:climateMode==='cold'?20:climateMode==='drought'?78:52,
      humidity:climateMode==='drought'?22:climateMode==='cold'?46:61,
      resources:climateMode==='drought'?56:100,
      hazard:12,
      mutationRate:0.08
    },
    species:speciesPresets.map((preset,index)=>{
      const x=140+index*170
      const y=170+index*60
      return {
        ...JSON.parse(JSON.stringify(preset)),
        lineage:preset.id,
        population:80-index*8,
        x,y,vx:(random()-.5)*2,vy:(random()-.5)*2,
        targetX:x,targetY:y,
        lastSplitTick:-999,
        agents:createAgents(random,clamp(Math.round((80-index*8)/8),3,22),x,y)
      }
    }),
    history:[]
  }
  recordHistory(world)
  return world
}

function recordHistory(world){
  world.history.push({tick:world.tick,species:world.species.map(s=>({id:s.id,name:s.name,population:s.population,color:s.color}))})
  if(world.history.length>80)world.history.shift()
}

function applyEcologyFeedback(world){
  const env=world.environment
  const totalPopulation=world.species.reduce((sum,s)=>sum+s.population,0)
  const grazerLoad=world.species.filter(s=>s.lineage==='grazer'||s.id==='grazer').reduce((sum,s)=>sum+s.population,0)
  const predatorLoad=world.species.filter(s=>s.lineage==='predator'||s.id==='predator').reduce((sum,s)=>sum+s.population,0)
  const scavengerLoad=world.species.filter(s=>s.lineage==='scavenger'||s.id==='scavenger').reduce((sum,s)=>sum+s.population,0)
  const parasiteLoad=world.species.filter(s=>s.lineage==='parasite'||s.id==='parasite').reduce((sum,s)=>sum+s.population,0)

  env.resources=clamp(
    env.resources
      - grazerLoad*0.045
      - totalPopulation*0.01
      + scavengerLoad*0.015,
    8,140
  )

  env.hazard=clamp(
    env.hazard
      + parasiteLoad*0.01
      + predatorLoad*0.003
      - scavengerLoad*0.006,
    5,40
  )

  env.humidity=clamp(
    env.humidity
      - grazerLoad*0.01
      + scavengerLoad*0.004,
    5,95
  )

  env.mutationRate=clamp(0.04+env.hazard/300+(env.climateMode==='volatile'?0.03:0)+Math.max(0,80-env.resources)/1200,0.04,0.2)

  return `生态反馈：草食负载 ${Math.round(grazerLoad)}，捕食负载 ${Math.round(predatorLoad)}，寄生负载 ${Math.round(parasiteLoad)}，资源回调至 ${env.resources.toFixed(0)}。`
}

function updateEnvironment(world){
  const r=world.random()
  const env=world.environment
  if(env.climateMode==='volatile'){
    env.temperature=clamp(env.temperature+(r-.5)*28,5,95)
    env.humidity=clamp(env.humidity+(world.random()-.5)*32,5,95)
  }else if(env.climateMode==='drought'){
    env.temperature=clamp(env.temperature+(r-.3)*8,40,95)
    env.humidity=clamp(env.humidity+(world.random()-.7)*8,5,40)
  }else if(env.climateMode==='cold'){
    env.temperature=clamp(env.temperature+(r-.7)*10,0,42)
    env.humidity=clamp(env.humidity+(world.random()-.4)*10,20,70)
  }else{
    env.temperature=clamp(env.temperature+(r-.5)*8,20,80)
    env.humidity=clamp(env.humidity+(world.random()-.5)*10,20,80)
  }
  env.resources=clamp(env.resources+(env.humidity/18)-(env.temperature/35)-(env.hazard/25)+(world.random()-.5)*4,10,140)
  env.hazard=clamp(env.hazard+(world.random()-.48)*8+(env.climateMode==='volatile'?2:0),5,40)
  env.mutationRate=clamp(0.04+env.hazard/300+(env.climateMode==='volatile'?0.03:0),0.04,0.2)
  return `Tick ${world.tick}: 气温 ${env.temperature.toFixed(0)}，湿度 ${env.humidity.toFixed(0)}，资源 ${env.resources.toFixed(0)}，风险 ${env.hazard.toFixed(0)}，突变率 ${env.mutationRate.toFixed(2)}`
}

function applyStrategies(world,strategyProvider){
  const narratives=[]
  for(const species of world.species){
    const strategy=strategyProvider.getStrategy({world,species})
    species.traits.speed=mutateTrait(species.traits.speed,strategy.mutationBias.speed)
    species.traits.camouflage=mutateTrait(species.traits.camouflage,strategy.mutationBias.camouflage)
    species.traits.fertility=mutateTrait(species.traits.fertility,strategy.mutationBias.fertility)
    species.traits.metabolism=mutateTrait(species.traits.metabolism,strategy.mutationBias.metabolism)
    species.traits.resistance=mutateTrait(species.traits.resistance,strategy.mutationBias.resistance)
    species.traits.aggression=mutateTrait(species.traits.aggression,strategy.mutationBias.aggression)
    narratives.push(`${species.name}：${strategy.narrative}`)
  }
  return narratives
}

function applyMutation(world,species){
  const logs=[]
  const rate=world.environment.mutationRate
  if(world.random()<rate){
    const traitKeys=['speed','camouflage','fertility','metabolism','resistance','aggression']
    const key=traitKeys[Math.floor(world.random()*traitKeys.length)]
    const delta=world.random()<0.5?-2:2
    species.traits[key]=mutateTrait(species.traits[key],delta)
    logs.push(`突变：${species.name} 的 ${key} ${delta>0?'增强':'减弱'}。`)
  }
  return logs
}

function maybeSplitSpecies(world){
  const logs=[]
  const newborn=[]
  if(world.species.length>=8) return logs
  if(world.tick-world.lastSplitTick<20) return logs
  for(const species of world.species){
    if(world.species.length+newborn.length>=8) break
    if(species.population<150)continue
    if(world.environment.hazard<24)continue
    if(world.tick-species.lastSplitTick<35)continue
    if(world.random()>0.025)continue
    const traits=species.traits
    const divergence=Math.max(
      Math.abs(traits.speed-50),
      Math.abs(traits.camouflage-50),
      Math.abs(traits.resistance-50),
      Math.abs(traits.aggression-50)
    )
    if(divergence<24)continue
    world.splitCounter+=1
    const childId=`${species.id}_split_${world.splitCounter}`
    const childName=`${species.name}·分支${world.splitCounter}`
    const popShare=Math.max(20,Math.round(species.population*0.2))
    species.population=clamp(species.population-popShare,0,240)
    species.lastSplitTick=world.tick
    world.lastSplitTick=world.tick
    const childTraits=JSON.parse(JSON.stringify(species.traits))
    const key=['speed','camouflage','fertility','metabolism','resistance','aggression'][Math.floor(world.random()*6)]
    childTraits[key]=mutateTrait(childTraits[key],world.random()<0.5?-6:6)
    const x=clamp(species.x+(world.random()-.5)*120,80,820)
    const y=clamp(species.y+(world.random()-.5)*120,80,440)
    newborn.push({
      id:childId,
      lineage:species.lineage||species.id,
      name:childName,
      role:`${species.role} / 谱系分裂`,
      color:shiftColor(species.color,world.random()<0.5?-18:18),
      traits:childTraits,
      population:popShare,
      x,y,vx:(world.random()-.5)*2,vy:(world.random()-.5)*2,
      targetX:x,targetY:y,
      lastSplitTick:world.tick,
      agents:createAgents(world.random,clamp(Math.round(popShare/8),3,22),x,y)
    })
    logs.push(`物种分裂：${species.name} 在高风险且高密度条件下分化出新谱系 ${childName}。`)
  }
  if(newborn.length)world.species.push(...newborn)
  return logs
}

function find(world,id){return world.species.find(s=>s.id===id)}

function updateBoids(species,targetX,targetY){
  const agents=species.agents
  const maxSpeed=Math.max(.8,species.traits.speed/28)
  for(let i=0;i<agents.length;i++){
    const a=agents[i]
    let alignX=0,alignY=0,cohX=0,cohY=0,sepX=0,sepY=0,count=0
    for(let j=0;j<agents.length;j++){
      if(i===j)continue
      const b=agents[j]
      const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)
      if(d<80){
        alignX+=b.vx;alignY+=b.vy;cohX+=b.x;cohY+=b.y;count++
        if(d<20){sepX-=dx/(d||1);sepY-=dy/(d||1)}
      }
    }
    if(count){
      alignX/=count;alignY/=count;cohX=cohX/count-a.x;cohY=cohY/count-a.y
      a.vx+=alignX*.05+cohX*.003+sepX*.06
      a.vy+=alignY*.05+cohY*.003+sepY*.06
    }
    a.vx+=(targetX-a.x)*.0025
    a.vy+=(targetY-a.y)*.0025
    const speed=Math.hypot(a.vx,a.vy)||1
    if(speed>maxSpeed){a.vx=a.vx/speed*maxSpeed;a.vy=a.vy/speed*maxSpeed}
    a.x=clamp(a.x+a.vx,36,864)
    a.y=clamp(a.y+a.vy,36,484)
  }
}

function syncAgentCount(world,species){
  const desired=clamp(Math.round(species.population/8),3,22)
  while(species.agents.length<desired){
    species.agents.push({x:species.x+(world.random()-.5)*30,y:species.y+(world.random()-.5)*30,vx:(world.random()-.5),vy:(world.random()-.5)})
  }
  while(species.agents.length>desired){species.agents.pop()}
}

function resolveGameInteractions(world){
  const logs=[]
  const predator=find(world,'predator')
  const grazer=find(world,'grazer')
  const scavenger=find(world,'scavenger')
  const parasite=find(world,'parasite')

  if(predator&&grazer){
    const d=Math.hypot(predator.x-grazer.x,predator.y-grazer.y)
    if(d<90&&predator.population>0&&grazer.population>0){
      const hunt=Math.max(1,Math.round(predator.traits.aggression/25))
      grazer.population=clamp(grazer.population-hunt,0,240)
      predator.population=clamp(predator.population+Math.round(hunt*.4),0,240)
      logs.push(`捕食事件：${predator.name} 围猎 ${grazer.name} 群体，造成 ${hunt} 单位损失。`)
    }
  }

  if(scavenger&&grazer){
    const compete=Math.max(0,Math.round((scavenger.traits.metabolism-grazer.traits.metabolism)/40))
    if(compete>0&&world.environment.resources<85){
      grazer.population=clamp(grazer.population-compete,0,240)
      scavenger.population=clamp(scavenger.population+1,0,240)
      logs.push(`竞争事件：${scavenger.name} 在资源紧张时挤占了 ${grazer.name} 的生态位。`)
    }
  }

  if(parasite&&grazer){
    const d=Math.hypot(parasite.x-grazer.x,parasite.y-grazer.y)
    if(d<80&&grazer.population>0){
      const drain=Math.max(1,Math.round(parasite.traits.camouflage/35))
      grazer.population=clamp(grazer.population-drain,0,240)
      parasite.population=clamp(parasite.population+1,0,240)
      logs.push(`寄生事件：${parasite.name} 附着在 ${grazer.name} 群体附近，吸取了 ${drain} 单位生存优势。`)
    }
  }
  return logs
}

function moveSpecies(world,s){
  const predator=find(world,'predator')
  const grazer=find(world,'grazer')
  let tx=s.targetX,ty=s.targetY
  const noiseX=(world.random()-.5)*20
  const noiseY=(world.random()-.5)*20
  if(s.id==='predator'&&grazer){
    tx=grazer.x+noiseX;ty=grazer.y+noiseY
  }else if((s.id==='grazer'||s.lineage==='grazer')&&predator){
    tx=s.x-(predator.x-s.x)*.55+noiseX;ty=s.y-(predator.y-s.y)*.55+noiseY
  }else if(s.id==='scavenger'||s.lineage==='scavenger'){
    tx=(world.environment.resources>80?420:650)+noiseX;ty=260+noiseY
  }else if((s.id==='parasite'||s.lineage==='parasite')&&grazer&&predator){
    tx=((grazer.x+predator.x)/2)+noiseX;ty=((grazer.y+predator.y)/2)+noiseY
  }else{
    tx+=noiseX;ty+=noiseY
  }
  s.targetX=clamp(tx,60,840)
  s.targetY=clamp(ty,60,460)
  updateBoids(s,s.targetX,s.targetY)
  const center=avgPos(s.agents)
  s.vx=(center.x-s.x)*.2
  s.vy=(center.y-s.y)*.2
  s.x=center.x
  s.y=center.y
}

function resolvePopulation(world){
  const env=world.environment
  const predator=find(world,'predator')
  const logs=[]
  for(const species of world.species){
    const t=species.traits
    const resourceGain=env.resources*(.004+t.metabolism/4000)
    const fertilityGain=t.fertility/24
    const temperatureStress=Math.abs(env.temperature-50)/12
    const droughtStress=env.humidity<25?(70-t.resistance)/28:0
    const hazardStress=env.hazard/10-t.resistance/32
    let predationStress=0
    if(species.id!=='predator'&&predator){
      const proximity=1/Math.max(1,Math.hypot(predator.x-species.x,predator.y-species.y)/120)
      predationStress=proximity*(predator.population/220)-((t.speed+t.camouflage)/220)
    }
    const delta=resourceGain+fertilityGain-temperatureStress-droughtStress-hazardStress-predationStress
    species.population=clamp(Math.round(species.population+delta),0,240)
    logs.push(...applyMutation(world,species))
    syncAgentCount(world,species)
    moveSpecies(world,species)
  }
  return logs
}

export function stepWorld(world,strategyProvider){
  world.tick+=1
  const environmentNarrativeBase=updateEnvironment(world)
  const ecologyNarrative=applyEcologyFeedback(world)
  const speciesNarratives=[]
  speciesNarratives.push(...applyStrategies(world,strategyProvider))
  speciesNarratives.push(...resolveGameInteractions(world))
  speciesNarratives.push(...resolvePopulation(world))
  speciesNarratives.push(...maybeSplitSpecies(world))
  recordHistory(world)
  return{environmentNarrative:`${environmentNarrativeBase}；${ecologyNarrative}`,speciesNarratives}
}
