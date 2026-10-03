import { View, StyleSheet, Platform } from "react-native";
import { colors, radius } from "./theme";

// Leaflet map (OpenStreetMap tiles) with a pin on the shop.
function buildHtml(lat, lng, title) {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<style>
html,body,#map{height:100%;margin:0;background:#F1EAF8}
.pin{width:30px;height:30px;background:#6B3FA0;border:3px solid #fff;border-radius:50% 50% 50% 0;
transform:rotate(-45deg);box-shadow:0 3px 8px rgba(0,0,0,.35)}
.pin:after{content:"";position:absolute;width:10px;height:10px;background:#fff;border-radius:50%;top:7px;left:7px}
</style></head><body><div id="map"></div><script>
var map=L.map('map',{zoomControl:true}).setView([${lat},${lng}],16);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,
attribution:'&copy; OpenStreetMap'}).addTo(map);
var icon=L.divIcon({className:'',html:'<div class="pin"></div>',iconSize:[30,30],iconAnchor:[15,30],popupAnchor:[0,-30]});
L.marker([${lat},${lng}],{icon:icon}).addTo(map).bindPopup(${JSON.stringify(title)}).openPopup();
</script></body></html>`;
}

export default function ShopMap({ lat, lng, title, height = 240 }) {
  const html = buildHtml(lat, lng, title);

  let content;
  if (Platform.OS === "web") {
    // Expo web: render Leaflet inside an iframe
    content = (
      <iframe
        title="Shop location"
        srcDoc={html}
        style={{ border: 0, width: "100%", height: "100%" }}
      />
    );
  } else {
    // Native: needs `npx expo install react-native-webview`
    const { WebView } = require("react-native-webview");
    content = (
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={{ flex: 1 }}
        javaScriptEnabled
        scrollEnabled={false}
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
