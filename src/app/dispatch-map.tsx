import type { DispatchPlan, DispatchScenario, PublicDispatchModel } from "@/lib/dispatch-types";

export const courierColors = ["#1644d3", "#087971", "#a14c15"];

export function DispatchMap({ model, scenario, plan, courierId, shipmentId }: { model: PublicDispatchModel; scenario: DispatchScenario; plan?: DispatchPlan; courierId: string; shipmentId: string | null }) {
  const nodes = new Map(model.nodes.map((node) => [node.id, node]));
  const shipments = model.shipments.filter((shipment) => !shipment.optional || scenario.urgent);
  return <svg className="network-map" viewBox="0 0 800 535" role="img" aria-label="Delivery network with eight locations, road closures and selected courier routes">
    <path d="M560 -20 C490 140 570 270 535 350 S530 490 600 560" fill="none" stroke="#dce9f5" strokeWidth="30" />
    <text x="554" y="266" fill="#6889a8" fontSize="12" transform="rotate(79 554 266)">River</text>
    {model.roads.map((road) => {
      const from = nodes.get(road.from)!; const to = nodes.get(road.to)!; const closed = scenario.closedRoads.includes(road.id);
      return <g key={road.id}><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={closed ? "#c13849" : "#c9d3e3"} strokeWidth={closed ? 5 : 3} strokeDasharray={closed || road.bikeOnly ? "7 6" : undefined} /><text x={(from.x + to.x) / 2 + 8} y={(from.y + to.y) / 2 - 8} fill={closed ? "#a32230" : "#6c7c90"} fontSize="12">{closed ? "Closed" : `${road.minutes}${road.bikeOnly ? " · bikes" : ""}`}</text></g>;
    })}
    {plan?.routes.filter((route) => courierId === "all" || route.courierId === courierId).map((route) => <polyline key={route.courierId} points={route.nodes.map((id) => `${nodes.get(id)!.x},${nodes.get(id)!.y}`).join(" ")} fill="none" stroke={courierColors[model.couriers.findIndex((courier) => courier.id === route.courierId)]} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity={courierId === "all" ? 0.6 : 1} />)}
    {model.nodes.map((node) => {
      const selected = shipments.some((shipment) => shipment.id === shipmentId && shipment.destination === node.id);
      const count = shipments.filter((shipment) => shipment.destination === node.id).length;
      return <g key={node.id}><circle cx={node.x} cy={node.y} r={node.id === model.depot ? 14 : 10} fill={node.id === model.depot ? "#17304e" : "white"} stroke={selected ? "#1644d3" : "#7f92ac"} strokeWidth={selected ? 5 : 2} /><text x={node.x} y={node.y - 22} textAnchor="middle" fill="#17304e" fontSize="14" fontWeight="600">{node.name}</text>{count > 0 && <text x={node.x + 19} y={node.y + 5} fill="#526378" fontSize="12">{count} {count === 1 ? "drop" : "drops"}</text>}</g>;
    })}
  </svg>;
}
