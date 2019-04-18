import {
  Component,
  ViewEncapsulation,
  OnInit,
  Input,
  Output,
  OnChanges,
  SimpleChanges,
  EventEmitter,
  ViewChild,
  ElementRef,
  HostListener
} from "@angular/core";

import { FeatureCollection, Feature } from "geojson";
import * as L from "leaflet";
import "leaflet.markercluster";
import "leaflet.locatecontrol";

// import { AppConfig } from "../../../../conf/app.config";
import { MAP_CONFIG } from "../../../../conf/map.config";
import { MarkerClusterGroup } from "leaflet";

const conf = {
  MAP_ID: "obsMap",
  GEOLOCATION_HIGH_ACCURACY: false,
  BASE_LAYERS: MAP_CONFIG["BASEMAP"].reduce((acc, baseLayer: Object) => {
    acc[baseLayer["name"]] = L.tileLayer(baseLayer["layer"], {
      name: baseLayer["name"],
      attribution: baseLayer["attribution"],
      subdomains: baseLayer["subdomains"],
      detectRetina: baseLayer["detectRetina"],
      maxZoom: baseLayer["maxZoom"],
      bounds: baseLayer["bounds"]
    });
    return acc;
  }, {}),
  DEFAULT_BASE_MAP: () => {
    // Get a random base map to test
    // return conf.BASE_LAYERS[
    //   Object.keys(conf.BASE_LAYERS)[
    //     (Math.random() * MAP_CONFIG["BASEMAP"].length) >> 0
    //   ]
    // ];
    return conf.BASE_LAYERS["OpenStreetMapFRHot"];
  },
  ZOOM_CONTROL_POSITION: "topright",
  BASE_LAYER_CONTROL_POSITION: "topright",
  BASE_LAYER_CONTROL_INIT_COLLAPSED: true,
  GEOLOCATION_CONTROL_POSITION: "topright",
  SCALE_CONTROL_POSITION: "bottomleft",
  NEW_OBS_MARKER_ICON: () =>
    L.icon({
      iconUrl: "assets/pointer-blue2.png",
      iconSize: [33, 42],
      iconAnchor: [16, 42]
    }),
  OBS_MARKER_ICON: () =>
    L.icon({
      iconUrl: "assets/pointer-green.png",
      iconSize: [33, 42],
      iconAnchor: [16, 42]
    }),
  OBSERVATION_LAYER: () =>
    L.markerClusterGroup({
      iconCreateFunction: clusters => {
        const childCount = clusters.getChildCount();
        return conf.CLUSTER_MARKER_ICON(childCount);
      }
    }),
  CLUSTER_MARKER_ICON: (childCount: number) => {
    const quantifiedCssClass = (childCount: number) => {
      let c = " marker-cluster-";
      if (childCount < 10) {
        c += "small";
      } else if (childCount < 10) {
        c += "medium";
      } else {
        c += "large";
      }
      return c;
    };
    return new L.DivIcon({
      html: `<div><span>${childCount}</span></div>`,
      className: "marker-cluster" + quantifiedCssClass(childCount),
      iconSize: new L.Point(40, 40)
    });
  },
  // ON_EACH_FEATURE: (feature, layer) => {
  //   let popupContent = `
  //     <img src="${
  //       feature.properties.image
  //         ? feature.properties.image
  //         : "assets/Azure-Commun-019.JPG"
  //     }">
  //     <p>
  //       <b>${feature.properties.common_name}</b>
  //       </br>
  //       <span i18n>
  //         Observé par ${feature.properties.observer.username}
  //         </br>
  //         le ${feature.properties.date}
  //       </span>
  //     </p>
  //     <div>
  //       <img class="icon" src="assets/binoculars.png">
  //     </div>`;
  //
  //   if (feature.properties && feature.properties.popupContent) {
  //     popupContent += feature.properties.popupContent;
  //   }
  //
  //   layer.bindPopup(popupContent);
  // },
  // POINT_TO_LAYER: (_feature, latlng): L.Marker => {
  //   console.log(_feature);
  //   return L.marker(latlng, { icon: conf.OBS_MARKER_ICON() });
  // },
  PROGRAM_AREA_STYLE: _feature => {
    return {
      fillColor: "transparent",
      weight: 2,
      opacity: 0.8,
      color: "red",
      dashArray: "4"
    };
  }
};

@Component({
  selector: "app-obs-map",
  template: `
    <div [id]="options.MAP_ID" #map></div>
  `,
  styleUrls: ["./map.component.css"],
  encapsulation: ViewEncapsulation.None
})
export class ObsMapComponent implements OnInit, OnChanges {
  /*
   PLAN: migrate layer logic to parent component/service, rm inputs
    instance config (element_id, tilehost, attribution, ... std leaflet options)
      @outputs:
        onClick
        onLayerAdded
        onLayerRemoved
  */
  @ViewChild("map") map: ElementRef;
  @Input("observations") observations: FeatureCollection;
  @Input("program") program: FeatureCollection;
  @Output() onClick: EventEmitter<L.Point> = new EventEmitter();
  options: any;
  observationMap: L.Map;
  programMaxBounds: L.LatLngBounds;
  observationLayer: MarkerClusterGroup;
  newObsMarker: L.Marker;

  markers: {
    feature: Feature;
    marker: L.Marker<any>;
  }[] = [];

  obsPopup: Feature;
  openPopupAfterClose: boolean;

  ngOnInit() {
    console.log("map ngOnInit");
    this.initMap(conf);
  }

  ngOnChanges(_changes: SimpleChanges) {
    console.log("_changes", _changes);

    if (
      this.observationMap &&
      _changes.program &&
      _changes.program.currentValue
    ) {
      this.loadProgramArea();
    }

    if (
      this.observationMap &&
      _changes.observations &&
      _changes.observations.currentValue
    ) {
      this.loadObservations();

      /*
      // TODO: revisit fix for disappearing base layer when back in navigation history.
      // update when switching layers from control.
      // save configured map state (base_layer, center, zoom) in localStorage ?
      let base_layer = this.observationMap.options.layers[0];
      // console.debug(base_layer["options"]["name"]);
      this.observationMap.removeLayer(this.observationMap.options.layers[0]);
      conf.BASE_LAYERS[base_layer["options"]["name"]].addTo(
        this.observationMap
      );
      this.observationMap.invalidateSize();
      */
    }
  }

  initMap(options: any, LeafletOptions: L.MapOptions = {}): void {
    this.options = options;
    this.observationMap = L.map(this.map.nativeElement, {
      layers: [this.options.DEFAULT_BASE_MAP()], // TODO: add program overlay ?
      ...LeafletOptions
    });

    // TODO: inject controls with options
    this.observationMap.zoomControl.setPosition(
      this.options.ZOOM_CONTROL_POSITION
    );

    L.control
      .scale({ position: this.options.SCALE_CONTROL_POSITION })
      .addTo(this.observationMap);

    L.control
      .layers(this.options.BASE_LAYERS, null, {
        collapsed: this.options.BASE_LAYER_CONTROL_INIT_COLLAPSED,
        position: this.options.BASE_LAYER_CONTROL_POSITION
      })
      .addTo(this.observationMap);

    L.control
      .locate({
        position: this.options.GEOLOCATION_CONTROL_POSITION,
        getLocationBounds: locationEvent =>
          locationEvent.bounds.extend(this.programMaxBounds),
        locateOptions: {
          enableHighAccuracy: this.options.GEOLOCATION_HIGH_ACCURACY
        }
      })
      .addTo(this.observationMap);

    this.observationMap.scrollWheelZoom.disable();
    this.observationMap.on("popupclose", e => {
      if (this.openPopupAfterClose && this.obsPopup) {
        this.showPopup(this.obsPopup);
      } else {
        this.obsPopup = null;
      }
      this.openPopupAfterClose = false;
    });
  }

  getPopupContent(feature): string {
    return `
      <img src="${
        feature.properties.image
          ? feature.properties.image
          : "assets/Azure-Commun-019.JPG"
      }">
      <p>
        <b>${feature.properties.common_name}</b>
        </br>
        <span i18n>
          Observé par ${feature.properties.observer.username || "Anonyme"}
          </br>
          le ${feature.properties.date}
        </span>
      </p>
      <div>
        <img class="icon" src="assets/binoculars.png">
      </div>`;
  }

  loadObservations(): void {
    if (this.observations) {
      if (this.observationLayer) {
        this.observationMap.removeLayer(this.observationLayer);
      }
      this.observationLayer = this.options.OBSERVATION_LAYER();
      this.markers = [];

      let options = {
        onEachFeature: (feature, layer) => {
          let popupContent = this.getPopupContent(feature);
          layer["toto"] = "toto";

          if (feature.properties && feature.properties.popupContent) {
            popupContent += feature.properties.popupContent;
          }

          layer.bindPopup(popupContent);
        },
        pointToLayer: (_feature, latlng): L.Marker => {
          let marker: L.Marker<any> = L.marker(latlng, {
            icon: conf.OBS_MARKER_ICON()
          });
          marker.on("click", () => {
            console.log(marker);
          });
          this.markers.push({
            feature: _feature,
            marker: marker
          });
          return marker;
        }
      };

      this.observationLayer.addLayer(L.geoJSON(this.observations, options));
      this.observationMap.addLayer(this.observationLayer);

      this.observationLayer.on("animationend", e => {
        console.log("animationend");
        if (this.obsPopup) {
          this.openPopupAfterClose = true;
          this.observationMap.closePopup();
        }
      });
    }
  }

  showPopup(obs: Feature): void {
    this.obsPopup = obs;
    let marker = this.markers.find(marker => {
      return (
        marker.feature.properties.id_observation ==
        obs.properties.id_observation
      );
    });
    let visibleParent: L.Marker = this.observationLayer.getVisibleParent(
      marker.marker
    );
    if (!visibleParent) {
      console.log("showPopup pan");
      this.observationMap.panTo(marker.marker.getLatLng());
      visibleParent = marker.marker;
    }
    let popup = L.popup()
      .setLatLng(visibleParent.getLatLng())
      .setContent(this.getPopupContent(obs))
      .openOn(this.observationMap);
  }

  loadProgramArea(canSubmit = true): void {
    if (this.program) {
      const programArea = L.geoJSON(this.program, {
        style: _feature => this.options.PROGRAM_AREA_STYLE(_feature)
      }).addTo(this.observationMap);
      const programBounds = programArea.getBounds();
      this.observationMap.fitBounds(programBounds);
      // this.observationMap.setMaxBounds(programBounds)

      this.newObsMarker = null;
      if (canSubmit) {
        this.observationMap.on("click", (e: L.LeafletMouseEvent) => {
          let coords = L.point(e.latlng.lng, e.latlng.lat);
          if (this.newObsMarker !== null) {
            this.observationMap.removeLayer(this.newObsMarker);
          }

          // PROBLEM: if program area is a concave polygon: one can still put a marker in the cavities.
          // POSSIBLE SOLUTION: See ray casting algorithm for inspiration
          // https://stackoverflow.com/questions/31790344/determine-if-a-point-reside-inside-a-leaflet-polygon
          if (programBounds.contains([e.latlng.lat, e.latlng.lng])) {
            this.newObsMarker = L.marker(e.latlng, {
              icon: this.options.NEW_OBS_MARKER_ICON()
            }).addTo(this.observationMap);
          }
          console.debug(coords);
          // emit new coordinates
          this.onClick.emit(coords);
        });
      }
      this.programMaxBounds = programBounds;
    }
  }

  canStart(): void {}

  @HostListener("document:NewObservationEvent", ["$event"])
  newObservationEventHandler(e: CustomEvent) {
    e.stopPropagation();
    console.debug("[ObsMapComponent.newObservationEventHandler]", e.detail);
  }
}
