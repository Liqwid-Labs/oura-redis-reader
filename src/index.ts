import * as Redis from 'ioredis'
import JSONbig from 'json-bigint'

const JSONbigint = JSONbig({
  alwaysParseAsBig: true,
  useNativeBigInt: true,
  constructorAction: 'preserve'
})

async function *readRedisStream(client: Redis.Redis, streamName: string): AsyncGenerator<any> {
  let currentId = '$'
  while (true) {
    try {
      const response = await client.xread(
        'BLOCK',
        5000,
        'STREAMS',
        streamName,
        currentId
      )
      if (response) {
        const ms = response[0][1]
        for (const m of ms) {
          const event = JSONbigint.parse(m[1][1])
          if (event) {
            yield event
            currentId = m[0]
          }
        }
      }
    } catch (e) {}
  }
}

const getEpoch = (): bigint =>
  BigInt(Math.round(new Date().getTime() / 1000))

const targetSlot = 115778577n

const listenEvents = async (client: Redis.Redis) => {
  const streamName = 'cardano-events'
  let firstSlot: bigint | undefined = undefined
  let timeOfFirstSlot: bigint | undefined = undefined
  let lastTime: bigint | undefined = undefined

  for await (const event of readRedisStream(client, streamName)) {
    const context = event.context
    if (context && context.slot) {
      if (!firstSlot || !timeOfFirstSlot || !lastTime) {
        timeOfFirstSlot = getEpoch()
        lastTime = timeOfFirstSlot
        firstSlot = context.slot
      } else {
        const currentTime = getEpoch()
        const currentSlot = context.slot
        if (currentTime !== timeOfFirstSlot && currentTime !== lastTime) {
          const averageSlotsPerSecond = (currentSlot - firstSlot) / (currentTime - timeOfFirstSlot)
          const slotsLeft = targetSlot - currentSlot
          console.log('================================================================================')
          console.log(`first slot: ${firstSlot}`)
          console.log(`current slot: ${currentSlot}`)
          console.log(`target slot: ${targetSlot}`)
          console.log(`time of first slot: ${timeOfFirstSlot}`)
          console.log(`current time: ${currentTime}`)
          console.log(`average slots read per second since start: ${averageSlotsPerSecond}/s`)
          console.log(`estimated seconds until fully synced: ${slotsLeft / averageSlotsPerSecond}s`)
          console.log('================================================================================')
        }
        lastTime = currentTime
      }
    }
  }
}

const redisConfig = {
  sentinels: [
    {
      host: 'localhost',
      port: 26379
    }
  ],
  name: 'mymaster',
}

const client: Redis.Redis = new Redis.Redis(redisConfig)

listenEvents(client)
