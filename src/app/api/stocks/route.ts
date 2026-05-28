import { NextResponse } from 'next/server'

interface NaverStock {
  itemCode: string
  stockName: string
  stockEndType: string
  closePriceRaw: number
  compareToPreviousClosePriceRaw: number
  fluctuationsRatio: string
  marketValueRaw: number
  accumulatedTradingVolumeRaw: number
}

interface NaverIndex {
  closePrice: string
  compareToPreviousClosePrice: string
  fluctuationsRatio: string
  compareToPreviousPrice: { code: string }
  marketStatus: string
  localTradedAt: string
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  'Referer': 'https://m.stock.naver.com/',
  'Accept': 'application/json',
}

async function fetchPage(page: number): Promise<NaverStock[]> {
  const url = `https://m.stock.naver.com/api/stocks/marketValue/KOSPI?page=${page}&pageSize=100`
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`Naver stocks ${res.status}`)
  const data = await res.json()
  return data.stocks ?? []
}

async function fetchIndex(): Promise<NaverIndex> {
  const res = await fetch('https://m.stock.naver.com/api/index/KOSPI/basic', {
    headers: HEADERS,
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Naver index ${res.status}`)
  return res.json()
}

export async function GET() {
  try {
    const [pages, idx] = await Promise.all([
      Promise.all([1, 2, 3].map(fetchPage)),
      fetchIndex(),
    ])

    const stocks = pages
      .flat()
      .filter(s => s.stockEndType === 'stock' && s.marketValueRaw > 0)
      .map(s => ({
        code: s.itemCode,
        name: s.stockName,
        price: s.closePriceRaw,
        change: parseFloat(s.fluctuationsRatio) || 0,
        changePrice: s.compareToPreviousClosePriceRaw,
        marketCap: s.marketValueRaw,
        volume: s.accumulatedTradingVolumeRaw,
      }))

    const isRising = idx.compareToPreviousPrice.code === '2'
    const index = {
      value: idx.closePrice,
      change: idx.compareToPreviousClosePrice,
      changeRate: idx.fluctuationsRatio,
      isRising,
      marketStatus: idx.marketStatus,
      tradedAt: idx.localTradedAt,
    }

    return NextResponse.json({
      stocks,
      index,
      total: stocks.length,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error', stocks: [], total: 0, updatedAt: new Date().toISOString() },
      { status: 500 }
    )
  }
}
