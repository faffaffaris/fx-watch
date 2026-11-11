import { useEffect, useRef, useState } from "react";
import {
  ArcType,
  Cartesian2,
  Cartesian3,
  Color,
  ColorMaterialProperty,
  ConstantProperty,
  GeoJsonDataSource,
  ImageryLayer,
  JulianDate,
  PolylineDashMaterialProperty,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  UrlTemplateImageryProvider,
  Viewer,
  EllipsoidTerrainProvider,
} from "cesium";
import type { Entity } from "cesium";
import { buildArcs } from "../lib/arcs";
import { countryFill } from "../lib/countryColor";
import { asOf } from "../score/series";
import type { Facility, IndicatorId, LayerId, ScoredCountry } from "../types";

type CameraTarget =
  | { kind: "world" }
  | { kind: "region"; longitude: number; latitude: number }
  | { kind: "country"; longitude: number; latitude: number };

type GlobeProps = {
  countries: ScoredCountry[];
  facilities: Facility[];
  layer: LayerId;
  indicatorId: IndicatorId;
  regionId: string | null;
  selectedIso: string | null;
  year: number;
  camera: CameraTarget;
  onPick: (iso3: string) => void;
};

function featureIso(entity: Entity): string | null {
  if (!entity.properties) return null;
  const bag = entity.properties as unknown as Record<string, { getValue?: (time: JulianDate) => unknown } | undefined>;
  const time = JulianDate.now();
  const read = (key: string) => {
    const value = bag[key]?.getValue?.(time);
    return typeof value === "string" ? value : "";
  };
  const iso = ["ISO_A3_EH", "ISO_A3", "ADM0_A3", "iso_a3"]
    .map(read)
    .find((value) => value && value !== "-99");
  if (iso) return iso;
  const name = read("NAME") || read("ADMIN");
  if (name === "Kosovo") return "XKX";
  if (name === "France") return "FRA";
  if (name === "Norway") return "NOR";
  return null;
}

export function Globe({
  countries,
  facilities,
  layer,
  indicatorId,
  regionId,
  selectedIso,
  year,
  camera,
  onPick,
}: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const dataRef = useRef<GeoJsonDataSource | null>(null);
  const arcIdsRef = useRef<string[]>([]);
  const onPickRef = useRef(onPick);
  const [boundaryTick, setBoundaryTick] = useState(0);
  onPickRef.current = onPick;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const viewer = new Viewer(container, {
      baseLayer: new ImageryLayer(
        new UrlTemplateImageryProvider({
          url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          credit: "Esri, Maxar, Earthstar Geographics, and the GIS User Community",
          maximumLevel: 19,
        }),
      ),
      terrainProvider: new EllipsoidTerrainProvider(),
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
    });
    viewer.scene.globe.enableLighting = false;
    viewer.scene.globe.baseColor = Color.fromCssColorString("#071018");
    viewer.cesiumWidget.creditContainer.setAttribute("data-cesium-credit", "true");
    viewerRef.current = viewer;

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: { position: Cartesian2 }) => {
      const picked = viewer.scene.pick(click.position);
      const entity = picked?.id as Entity | undefined;
      const iso = entity?.name;
      if (iso && /^[A-Z]{3}$/.test(iso)) onPickRef.current(iso);
    }, ScreenSpaceEventType.LEFT_CLICK);

    let cancelled = false;
    GeoJsonDataSource.load("/geo/countries.geojson", {
      stroke: Color.TRANSPARENT,
      fill: Color.WHITE.withAlpha(0.02),
      clampToGround: true,
    })
      .then((data) => {
        if (cancelled) return;
        dataRef.current = data;
        for (const entity of data.entities.values) {
          const iso = featureIso(entity);
          if (iso) entity.name = iso;
          // GeoJSON polygons default to rhumb arcs. A border that crosses the
          // antimeridian, or two vertices that sit on top of each other, makes
          // Cesium's rhumb subdivision grow without bound and abort rendering.
          if (entity.polygon) entity.polygon.arcType = new ConstantProperty(ArcType.GEODESIC);
        }
        viewer.dataSources.add(data);
        setBoundaryTick((tick) => tick + 1);
      })
      .then(() => viewer.scene.requestRender())
      .catch((error: unknown) => {
        console.error("Country boundaries failed to load", error);
      });

    return () => {
      cancelled = true;
      handler.destroy();
      dataRef.current = null;
      viewerRef.current = null;
      viewer.destroy();
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    const data = dataRef.current;
    if (!viewer || !data) return;
    const peers = peerValues(countries, regionId, indicatorId, year);
    const byIso = new Map(countries.map((country) => [country.iso3, country]));
    for (const entity of data.entities.values) {
      if (!entity.polygon || !entity.name) continue;
      const country = byIso.get(entity.name);
      const fill = country
        ? countryFill(country, layer, indicatorId, regionId, facilities, peers, year)
        : { hex: "#334155", alpha: 0.4 };
      const selected = entity.name === selectedIso;
      entity.polygon.material = new ColorMaterialProperty(
        Color.fromCssColorString(fill.hex).withAlpha(selected ? 0.9 : fill.alpha),
      );
      entity.polygon.outline = new ConstantProperty(false);
    }
    paintArcs(
      viewer,
      arcIdsRef.current,
      layer === "cooperation"
        ? buildArcs(facilities, countries, selectedIso, regionMembers(countries, regionId))
        : [],
    );
    viewer.scene.requestRender();
  }, [countries, facilities, layer, indicatorId, regionId, selectedIso, year, boundaryTick]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const destination =
      camera.kind === "world"
        ? Cartesian3.fromDegrees(12, 16, 22_000_000)
        : Cartesian3.fromDegrees(camera.longitude, camera.latitude, camera.kind === "country" ? 4_200_000 : 11_000_000);
    viewer.camera.flyTo({ destination, duration: 1.25 });
  }, [camera]);

  return <div ref={containerRef} className="globe" />;
}

function peerValues(countries: ScoredCountry[], regionId: string | null, indicatorId: IndicatorId, year: number): number[] {
  return countries
    .filter((country) => regionId == null || country.regionId === regionId)
    .map((country) => asOf(country.series[indicatorId], year)?.value)
    .filter((value): value is number => value != null);
}

function regionMembers(countries: ScoredCountry[], regionId: string | null): string[] | null {
  if (!regionId) return null;
  return countries.filter((country) => country.regionId === regionId).map((country) => country.iso3);
}

function paintArcs(viewer: Viewer, arcIds: string[], arcs: ReturnType<typeof buildArcs>) {
  for (const id of arcIds) viewer.entities.removeById(id);
  arcIds.length = 0;
  for (const arc of arcs) {
    const color = arc.active ? Color.fromCssColorString("#ffb020") : arc.kind === "imf" ? Color.fromCssColorString("#d2a8ff") : Color.fromCssColorString("#8ec8e8");
    viewer.entities.add({
      id: `arc-${arc.id}`,
      polyline: {
        positions: Cartesian3.fromDegreesArray([
          arc.from.longitude,
          arc.from.latitude,
          arc.to.longitude,
          arc.to.latitude,
        ]),
        width: arc.width,
        arcType: ArcType.GEODESIC,
        material: arc.uncapped ? new PolylineDashMaterialProperty({ color, dashLength: 18 }) : color,
      },
    });
    arcIds.push(`arc-${arc.id}`);
  }
}
