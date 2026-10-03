import { useEffect, useRef } from "react";
import { View, Platform, StyleSheet } from "react-native";
import { colors, radius } from "./theme";

// Leaflet map where the customer taps (or drags the pin) to mark their location.
// Calls onPick(lat, lng) every time the pin is placed or moved.
function buildHtml(initial, bounds) {
  const center = initial ? [initial.lat, initial.lng] : [7.4478, 125.8078];
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<style>
html,body,#map{height:100%;margin:0;background:#F1EAF8}
.pin{width:30px;height:30px;background:#6B3FA0;border:3px solid #fff;border-radius:50% 50% 50% 0;
transform:rotate(-45deg);box-shadow:0 3px 8px rgba(0,0,0,.35)}
.pin:after{content:"";position:absolute;width:10px;height:10px;background:#fff;border-radius:50%;top:7px;left:7px}
.hint{position:absolute;z-index:999;left:50%;top:8px;transform:translateX(-50%);background:rgba(42,31,45,.82);
color:#fff;font:600 12px sans-serif;padding:6px 12px;border-radius:999px;pointer-events:none}
</style></head><body><div id="map"></div><div class="hint" id="hint">Tap the map to drop your pin</div><script>
var map=L.map('map',{maxBounds:[[${bounds.minLat},${bounds.minLng}],[${bounds.maxLat},${bounds.maxLng}]],minZoom:11})
  .setView([${center[0]},${center[1]}],${initial ? 17 : 14});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
var icon=L.divIcon({className:'',html:'<div class="pin"></div>',iconSize:[30,30],iconAnchor:[15,30]});
var marker=null;
function send(ll){
  var msg=JSON.stringify({type:'pin',lat:ll.lat,lng:ll.lng});
  if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(msg);}else{parent.postMessage(msg,'*');}
}
function place(ll,notify){
  if(!marker){
    marker=L.marker(ll,{icon:icon,draggable:true}).addTo(map);
    marker.on('dragend',function(){send(marker.getLatLng());});
  }else{marker.setLatLng(ll);}
  document.getElementById('hint').style.display='none';
  if(notify)send(ll);
}
${initial ? `place(L.latLng(${initial.lat},${initial.lng}),false);` : ""}
map.on('click',function(e){place(e.latlng,true);});
</script></body></html>`;
}

export default function LocationPicker({
  initial,
  bounds,
  onPick,
  height = 280,
}) {
  const htmlRef = useRef(null);
  // Build once so picking a spot does not reload the map.
  if (!htmlRef.current) htmlRef.current = buildHtml(initial, bounds);

  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  // Web: listen for messages coming from the iframe
  useEffect(() => {
    if (Platform.OS !== "web") return;
    function handler(e) {
      try {
        const d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (d && d.type === "pin") onPickRef.current(d.lat, d.lng);
      } catch {}
    }
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  let content;
  if (Platform.OS === "web") {
    content = (
      <iframe
        title="Pin your location"
        srcDoc={htmlRef.current}
        style={{ border: 0, width: "100%", height: "100%" }}
      />
    );
  } else {
    // Native: needs `npx expo install react-native-webview`
    const { WebView } = require("react-native-webview");
    content = (
      <WebView
        originWhitelist={["*"]}
        source={{ html: htmlRef.current }}
        style={{ flex: 1 }}
        javaScriptEnabled
        nestedScrollEnabled
        onMessage={(e) => {
          try {
            const d = JSON.parse(e.nativeEvent.data);
            if (d.type === "pin") onPickRef.current(d.lat, d.lng);
          } catch {}
        }}
      />
    );
  }

  return <View style={[styles.box, { height }]}>{content}</View>;
}

const styles = StyleSheet.create({
  box: {
    width: "100%",
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.plumTint,
  },
});
