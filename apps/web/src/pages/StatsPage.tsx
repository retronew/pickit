import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "#components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "#components/ui/chart";
import { PageLoading } from "#components/PageLoading";
import { Empty, EmptyHeader, EmptyTitle } from "#components/ui/empty";

interface Stats {
  total: number;
  byCategory: { category: string; count: number }[];
  byMonth: { month: string; count: number }[];
  clickTop: { id: number; name: string; clickCount: number }[];
  embeddingCoverage: number;
  deadLinks: number;
  trash: number;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-heading font-semibold text-2xl">{value}</p>
    </Card>
  );
}

const categoryChartConfig = {
  count: { label: "收藏数", color: "var(--chart-2)" },
} satisfies ChartConfig;

const monthChartConfig = {
  count: { label: "新增数", color: "var(--chart-2)" },
} satisfies ChartConfig;

const clickChartConfig = {
  clickCount: { label: "点击次数", color: "var(--chart-2)" },
} satisfies ChartConfig;

function truncateLabel(label: string, max = 8) {
  return label.length > max ? `${label.slice(0, max)}…` : label;
}

function ChartEmpty() {
  return (
    <Empty className="py-8">
      <EmptyHeader>
        <EmptyTitle>暂无数据</EmptyTitle>
      </EmptyHeader>
    </Empty>
  );
}

export function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/items/stats")
      .then((r) => r.json())
      .then(setStats);
  }, []);

  const categoryData = useMemo(
    () =>
      (stats?.byCategory ?? []).slice(0, 15).map((c) => ({
        ...c,
        label: truncateLabel(c.category),
      })),
    [stats],
  );

  const clickData = useMemo(
    () =>
      (stats?.clickTop ?? []).slice(0, 10).map((c) => ({
        ...c,
        label: truncateLabel(c.name),
      })),
    [stats],
  );

  if (!stats) {
    return <PageLoading />;
  }

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="font-heading font-semibold text-lg">统计</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="总收藏数" value={String(stats.total)} />
        <StatTile
          label="智能搜索覆盖"
          value={`${Math.round(stats.embeddingCoverage * 100)}%`}
        />
        <StatTile label="失效链接" value={String(stats.deadLinks)} />
        <StatTile label="回收站" value={String(stats.trash)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>分类分布</CardTitle>
            <CardDescription>按收藏数量排序，前 15 个</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <ChartEmpty />
            ) : (
              <ChartContainer
                config={categoryChartConfig}
                className="w-full"
                style={{
                  aspectRatio: "auto",
                  height: categoryData.length * 26 + 8,
                }}
              >
                <BarChart
                  accessibilityLayer
                  data={categoryData}
                  layout="vertical"
                  barSize={12}
                  margin={{ left: -8 }}
                >
                  <XAxis type="number" dataKey="count" hide />
                  <YAxis
                    dataKey="label"
                    type="category"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    width={108}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <Bar dataKey="count" fill="var(--color-count)" radius={5} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
          {categoryData.length > 0 && (
            <CardFooter className="text-muted-foreground text-sm">
              共 {stats.byCategory.length} 个分类
            </CardFooter>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>每月新增</CardTitle>
            <CardDescription>按添加时间统计</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.byMonth.length === 0 ? (
              <ChartEmpty />
            ) : (
              <ChartContainer config={monthChartConfig}>
                <BarChart
                  accessibilityLayer
                  data={stats.byMonth}
                  margin={{ top: 20 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <Bar dataKey="count" fill="var(--color-count)" radius={8} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {clickData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>最常点击</CardTitle>
            <CardDescription>点击次数最多的收藏</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={clickChartConfig}
              className="w-full"
              style={{ aspectRatio: "auto", height: clickData.length * 26 + 8 }}
            >
              <BarChart
                accessibilityLayer
                data={clickData}
                layout="vertical"
                barSize={12}
                margin={{ left: -8 }}
              >
                <XAxis type="number" dataKey="clickCount" hide />
                <YAxis
                  dataKey="label"
                  type="category"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  width={108}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Bar
                  dataKey="clickCount"
                  fill="var(--color-clickCount)"
                  radius={5}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
