import DashboardScreen from "@/features/dashboard/DashboardScreen";

export default function DashboardPage() {
  return (
    <DashboardScreen
      initialKpis={null}
      initialFunil={null}
      initialSeries={null}
      initialVagas={[]}
      initialAreas={[]}
      initialTopMatches={[]}
    />
  );
}
