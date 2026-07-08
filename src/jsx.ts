/**
 * ExtendScript prelude injected into every script sent to Illustrator.
 *
 * This runs *inside* Illustrator (ExtendScript / ES3-ish). It provides:
 *   - __json / __jstr : a tiny JSON serializer (ExtendScript has no JSON object)
 *   - __doc           : the active document, with a friendly error if none is open
 *   - __color         : hex / named color -> RGB or CMYK color for the active doc
 *   - __setPos        : place an item using top-left, artboard-relative, Y-down coords
 *   - __style         : apply fill / stroke / strokeWidth (handles text frames)
 *   - __itemInfo      : a compact, user-friendly description of a page item
 *
 * Written with String.raw so it is emitted to Illustrator verbatim (no TS escape
 * processing). Do NOT use backticks or ${...} inside this block.
 */
export const PRELUDE: string = String.raw`
var __NAMED = {
  black:'#000000', white:'#FFFFFF', red:'#FF0000', green:'#00A650', blue:'#0000FF',
  yellow:'#FFF200', orange:'#FF7F00', purple:'#7F00FF', pink:'#FF66CC',
  gray:'#808080', grey:'#808080', cyan:'#00FFFF', magenta:'#FF00FF', none:'none'
};

function __jstr(s){
  s = String(s);
  var out = '"';
  for (var i = 0; i < s.length; i++){
    var c = s.charAt(i);
    var code = s.charCodeAt(i);
    if (c === '"') out += '\\"';
    else if (c === '\\') out += '\\\\';
    else if (c === '\n') out += '\\n';
    else if (c === '\r') out += '\\r';
    else if (c === '\t') out += '\\t';
    else if (code < 32){
      var h = code.toString(16);
      out += '\\u0000'.substr(0, 6 - h.length) + h;
    }
    else out += c;
  }
  return out + '"';
}

function __json(o){
  var t = typeof o;
  if (o === null || t === 'undefined') return 'null';
  if (t === 'number') return isFinite(o) ? String(o) : 'null';
  if (t === 'boolean') return o ? 'true' : 'false';
  if (t === 'string') return __jstr(o);
  if (o instanceof Array){
    var a = [];
    for (var i = 0; i < o.length; i++) a.push(__json(o[i]));
    return '[' + a.join(',') + ']';
  }
  var parts = [];
  for (var k in o){
    if (o.hasOwnProperty(k)) parts.push(__jstr(k) + ':' + __json(o[k]));
  }
  return '{' + parts.join(',') + '}';
}

function __doc(){
  if (app.documents.length === 0)
    throw new Error("No document is open in Illustrator. Create one with illustrator_create_document or open one with illustrator_open_document.");
  return app.activeDocument;
}

function __activeAB(doc){
  var idx = doc.artboards.getActiveArtboardIndex();
  return doc.artboards[idx];
}

function __abRect(){
  return __activeAB(app.activeDocument).artboardRect; // [left, top, right, bottom]
}

function __hexToRgb(hex){
  hex = String(hex).replace('#','');
  if (hex.length === 3) hex = hex.charAt(0)+hex.charAt(0)+hex.charAt(1)+hex.charAt(1)+hex.charAt(2)+hex.charAt(2);
  var r = parseInt(hex.substr(0,2),16);
  var g = parseInt(hex.substr(2,2),16);
  var b = parseInt(hex.substr(4,2),16);
  if (isNaN(r) || isNaN(g) || isNaN(b))
    throw new Error("Invalid color. Use a hex value like '#FF7F00', a 3/6-digit hex, a name (red, blue, ...), or 'none'.");
  return { r:r, g:g, b:b };
}

function __rgbToCmyk(r,g,b){
  var rr = r/255, gg = g/255, bb = b/255;
  var k = 1 - Math.max(rr, Math.max(gg, bb));
  if (k >= 1) return [0,0,0,100];
  return [ (1-rr-k)/(1-k)*100, (1-gg-k)/(1-k)*100, (1-bb-k)/(1-k)*100, k*100 ];
}

function __color(value){
  if (value === null || value === undefined) return null;
  var v = String(value);
  var lower = v.toLowerCase();
  if (__NAMED.hasOwnProperty(lower)) v = __NAMED[lower];
  if (String(v).toLowerCase() === 'none') return new NoColor();
  var rgb = __hexToRgb(v);
  var doc = app.activeDocument;
  if (doc && doc.documentColorSpace === DocumentColorSpace.CMYK){
    var cmyk = __rgbToCmyk(rgb.r, rgb.g, rgb.b);
    var c = new CMYKColor();
    c.cyan = cmyk[0]; c.magenta = cmyk[1]; c.yellow = cmyk[2]; c.black = cmyk[3];
    return c;
  }
  var col = new RGBColor();
  col.red = rgb.r; col.green = rgb.g; col.blue = rgb.b;
  return col;
}

/** Place item using top-left corner, measured from the top-left of the active
 *  artboard, with Y increasing downward (like most design tools). */
function __setPos(item, x, y){
  var ab = __abRect();
  item.position = [ ab[0] + x, ab[1] - y ];
}

function __style(item, P){
  var isText = (item.typename === 'TextFrame');
  if (P.fill !== undefined && P.fill !== null){
    var fc = __color(P.fill);
    if (isText){
      if (fc.typename !== 'NoColor') item.textRange.characterAttributes.fillColor = fc;
    } else if (fc.typename === 'NoColor'){
      item.filled = false;
    } else {
      item.filled = true; item.fillColor = fc;
    }
  }
  if (!isText && P.stroke !== undefined && P.stroke !== null){
    var sc = __color(P.stroke);
    if (sc.typename === 'NoColor'){ item.stroked = false; }
    else { item.stroked = true; item.strokeColor = sc; }
  }
  if (!isText && P.strokeWidth !== undefined && P.strokeWidth !== null){
    item.stroked = true; item.strokeWidth = P.strokeWidth;
  }
}

/** Compact, user-friendly info about a page item (coords are artboard-relative, Y-down). */
function __itemInfo(item){
  var ab = __abRect();
  var info = {
    name: (item.name || ''),
    type: item.typename,
    x: (item.left - ab[0]),
    y: (ab[1] - item.top),
    width: item.width,
    height: item.height
  };
  if (item.typename === 'TextFrame'){
    try { info.text = item.contents; } catch (e) {}
  }
  return info;
}
`;
