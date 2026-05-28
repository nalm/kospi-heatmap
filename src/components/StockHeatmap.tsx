'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import * as echarts from 'echarts'

interface Stock {
  code: string
  name: string
  price: number
  change: number
  changePrice: number
  marketCap: number
  volume: number
}

interface IndexInfo {
  value: string
  change: string
  changeRate: string
  isRising: boolean
  marketStatus: string
  tradedAt: string
}

function getColor(change: number): string {
  if (change >= 5) return '#8b0000'
  if (change >= 3) return '#c0392b'
  if (change >= 1) return '#e74c3c'
  if (change > 0) return '#ec7063'
  if (change === 0) return '#555555'
  if (change > -1) return '#5b9bd5'
  if (change > -3) return '#2e75b6'
  if (change > -5) return '#1a4f8a'
  return '#0d2f5c'
}

function buildOption(stocks: Stock[]): echarts.EChartsCoreOption {
  const data = stocks.map(s => ({
    name: s.name,
    value: s.marketCap,
    change: s.change,
    price: s.price,
    changePrice: s.changePrice,
    itemStyle: { color: getColor(s.change) },
  }))

  return {
    backgroundColor: '#111111',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(20,20,20,0.95)',
      borderColor: '#333',
      textStyle: { color: '#eee', fontSize: 13 },
      formatter: (params: echarts.DefaultLabelFormatterCallbackParams) => {
        const d = params.data as { change?: number; price?: number; changePrice?: number }
        if (typeof d?.change !== 'number') return `<b>${params.name}</b>`
        const sign = d.change >= 0 ? '+' : ''
        const priceSign = (d.changePrice ?? 0) >= 0 ? '+' : ''
        return [
          `<b>${params.name}</b>`,
          `등락률: <span style="color:${getColor(d.change)}">${sign}${d.change.toFixed(2)}%</span>`,
          `현재가: ${d.price?.toLocaleString()}원`,
          `전일대비: ${priceSign}${d.changePrice?.toLocaleString()}원`,
        ].join('<br/>')
      },
    },
    series: [
      {
        type: 'treemap',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        roam: false,
        nodeClick: undefined,
        breadcrumb: { show: false },
        visibleMin: 30,
        label: {
          show: true,
          color: '#ffffff',
          fontSize: 12,
          fontWeight: 'bold',
          lineHeight: 18,
          formatter: (params: echarts.DefaultLabelFormatterCallbackParams) => {
            const d = params.data as { change?: number }
            if (typeof d?.change !== 'number') return params.name
            const sign = d.change >= 0 ? '+' : ''
            return `${params.name}\n${sign}${d.change.toFixed(2)}%`
          },
          overflow: 'truncate',
        },
        itemStyle: {
          borderColor: '#111111',
          borderWidth: 1,
          gapWidth: 1,
        },
        data,
      },
    ],
  }
}

function IndexBadge({ idx }: { idx: IndexInfo }) {
  const color = idx.isRising ? '#e74c3c' : '#2e75b6'
  const arrow = idx.isRising ? '▲' : '▼'
  const sign = idx.isRising ? '+' : ''
  const statusLabel = idx.marketStatus === 'OPEN' ? '장중' : '장마감'
  const statusColor = idx.marketStatus === 'OPEN' ? '#4caf50' : '#888'

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: statusColor + '33', color: statusColor, border: `1px solid ${statusColor}55` }}>
        {statusLabel}
      </span>
      <span className="font-bold text-white text-base tracking-tight">
        KOSPI {idx.value}
      </span>
      <span className="text-sm font-medium" style={{ color }}>
        {arrow} {sign}{idx.change} ({sign}{idx.changeRate}%)
      </span>
    </div>
  )
}

export default function StockHeatmap() {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)
  const [lastUpdated, setLastUpdated] = useState('')
  const [stockCount, setStockCount] = useState(0)
  const [indexInfo, setIndexInfo] = useState<IndexInfo | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchAndRender = useCallback(async () => {
    try {
      const res = await fetch('/api/stocks')
      const data = await res.json()

      if (data.error && data.stocks.length === 0) {
        setError(data.error)
        setLoading(false)
        return
      }

      setError('')
      setStockCount(data.total)
      if (data.index) setIndexInfo(data.index)
      setLastUpdated(
        new Date(data.updatedAt).toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      )
      setLoading(false)

      if (!chartInstance.current) return
      chartInstance.current.setOption(buildOption(data.stocks), { notMerge: true })
    } catch (e) {
      setError(String(e))
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!chartRef.current) return
    chartInstance.current = echarts.init(chartRef.current)

    fetchAndRender()
    const interval = setInterval(fetchAndRender, 60000)

    const handleResize = () => chartInstance.current?.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', handleResize)
      chartInstance.current?.dispose()
    }
  }, [fetchAndRender])

  return (
    <div className="flex flex-col h-screen bg-[#111111] text-white">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-b border-[#333] shrink-0 gap-4 flex-wrap">
        {/* 좌측: 타이틀 + 지수 */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-bold text-base text-gray-300 tracking-tight whitespace-nowrap">
            KOSPI 마켓맵
          </span>
          <div className="w-px h-4 bg-[#444] hidden sm:block" />
          {indexInfo ? (
            <IndexBadge idx={indexInfo} />
          ) : (
            <span className="text-gray-500 text-sm">지수 로딩 중...</span>
          )}
        </div>

        {/* 우측: 범례 + 업데이트 */}
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <div className="hidden md:flex items-center gap-1 text-xs">
            {([-5, -3, -1, 0, 1, 3, 5] as const).map(v => (
              <div
                key={v}
                className="w-6 h-4 rounded-sm flex items-center justify-center text-[9px] text-white"
                style={{ backgroundColor: getColor(v) }}
              >
                {v > 0 ? `+${v}` : v}
              </div>
            ))}
            <span className="ml-1 text-gray-500">%</span>
          </div>
          {stockCount > 0 && (
            <span className="text-xs text-gray-500 whitespace-nowrap">{stockCount}종목</span>
          )}
          {lastUpdated && (
            <span className="text-xs whitespace-nowrap">{lastUpdated}</span>
          )}
          {!lastUpdated && !error && (
            <span className="animate-pulse text-xs">로딩 중...</span>
          )}
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 z-10">
            <div className="text-center">
              <div className="text-3xl mb-2">⟳</div>
              <div>데이터 로딩 중...</div>
            </div>
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 z-10">
            <div className="text-center">
              <div className="text-4xl mb-3">📊</div>
              <div className="text-lg mb-1">{error}</div>
            </div>
          </div>
        )}
        <div ref={chartRef} className="w-full h-full" />
      </div>

      {/* 푸터 */}
      <div className="px-4 py-1 text-[10px] text-gray-600 bg-[#1a1a1a] border-t border-[#333] shrink-0">
        출처: 네이버 금융 · 박스 크기: 시가총액 · 색상: 등락률 · 60초 자동 갱신
      </div>
    </div>
  )
}
