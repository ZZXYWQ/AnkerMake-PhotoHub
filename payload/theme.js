/* Shared visual language for controls added to the native editor. */
(()=>{'use strict';
const css=`
.epc-native{--ph-accent:#33bf5a;--ph-accent-soft:#effaf2;--ph-text:#25282a;--ph-muted:#85898c;--ph-line:#eceeef;--ph-fill:#f5f6f7;font:400 12px/1.5 "Mont For Anker","Microsoft YaHei UI",sans-serif!important;color:var(--ph-text)!important;box-sizing:border-box}
.epc-native *{box-sizing:border-box}.epc-native [hidden]{display:none!important}
.epc-native button,.epc-native input,.epc-native select{font:inherit!important;outline:none;transition:background-color .12s,border-color .12s}
.epc-native button{min-height:30px;border:1px solid var(--ph-line);border-radius:7px;background:#fff;color:var(--ph-text);padding:6px 12px}
.epc-native button:hover:not(:disabled){background:#f5f6f7}.epc-native button:focus-visible,.epc-native input:focus-visible,.epc-native select:focus-visible{outline:2px solid #33bf5a55;outline-offset:2px}
.epc-native button[role=switch]{min-height:0}.epc-native input[type=file]{width:100%;font:inherit;color:#85898c}.epc-native input[type=file]::file-selector-button{font:inherit;background:#f5f6f7;color:#333;border:0;border-radius:6px;padding:7px 10px;margin-right:10px}.epc-native button:disabled{opacity:.42;cursor:default}.epc-native input:not([type=checkbox]):not([type=color]):not([type=range]):not([type=file]),.epc-native select{height:30px;border:1px solid transparent!important;border-radius:7px!important;background:var(--ph-fill)!important;padding:5px 9px!important;min-width:0;color:var(--ph-text)}
.epc-native input[type=number]{width:84px;text-align:right;appearance:textfield}.epc-native input[type=number]::-webkit-inner-spin-button{appearance:none}
.epc-native input[type=color]{width:30px;height:26px;border:1px solid var(--ph-line);border-radius:6px;padding:3px;background:white}
.epc-native select{max-width:190px;cursor:pointer}.epc-native input[type=checkbox]{width:14px;height:14px;accent-color:var(--ph-accent);margin:0}
.epc-native input[role=switch]{appearance:none!important;position:relative;width:32px!important;height:18px!important;border:0!important;border-radius:18px!important;background:#d6d9db!important;flex:0 0 auto;cursor:pointer;transition:background .15s}
.epc-native input[role=switch]:before{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 2px #0002;transition:transform .15s}
.epc-native input[role=switch]:checked{background:var(--ph-accent)!important}.epc-native input[role=switch]:checked:before{transform:translateX(14px)}
.epc-native label{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:30px;font:inherit!important;color:#555b5e}
.epc-native .epc-field{display:grid;gap:12px;margin:0}.epc-native .epc-section-title{font-weight:600;font-size:12px;color:#25282a;margin:0 0 12px}
.epc-native .epc-panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:16px;font-weight:600;color:#25282a}
.epc-native .epc-panel-head label{min-height:18px}.epc-native .epc-panel-head small{font-size:11px;font-weight:400;color:#8b9093}
.epc-native .epc-helper{font-size:11px;line-height:1.65;color:#8b9093;margin:0}
.epc-native .epc-inline-row{display:flex;align-items:center;gap:8px;margin-bottom:12px}.epc-native .epc-inline-row label{flex:1}.epc-native .epc-mask-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.epc-native .epc-mask-action{font-size:11px!important;padding:6px 8px;text-align:left}.epc-native button[type=submit]{background:#181b1d;color:white;border-color:#181b1d;font-weight:600}.epc-native .epc-divider{height:1px;background:var(--ph-line);margin:4px 0}
.epc-native details{border:0!important;border-top:1px solid var(--ph-line)!important;padding:12px 0 0!important;margin-top:2px}
.epc-native summary{padding:0!important;cursor:pointer;font-size:11px;color:#85898c;list-style:none;display:flex;justify-content:space-between;align-items:center}
.epc-native summary:after{content:"⌄";font-size:14px}.epc-native details[open]>summary{margin-bottom:14px}.epc-native details[open]>summary:after{transform:rotate(180deg)}
.epc-native .epc-primary{background:#181b1d!important;color:white!important;border-color:#181b1d!important;font-weight:600!important}
.epc-native .epc-primary:hover:not(:disabled){background:#303538!important}.epc-native .epc-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px}
.epc-native progress{appearance:none;width:100%;height:3px;border:0;border-radius:3px;overflow:hidden}.epc-native progress::-webkit-progress-bar{background:#edf0ee}.epc-native progress::-webkit-progress-value{background:var(--ph-accent)}
.epc-native .epc-info{width:16px;height:16px;min-height:16px;padding:0;border:1px solid #c5c9cb;border-radius:50%;color:#8b9093;background:transparent;font-size:10px!important;line-height:14px}
#epc-native-bar{height:32px;padding:0 16px;gap:2px;border-color:#eff0f1;box-shadow:none}#epc-native-bar>button{border:0;min-height:26px;padding:4px 10px;border-radius:5px}
body.epc-native-layout #root{top:32px!important;height:calc(100% - 32px)!important}body.epc-native-layout.epc-tool-editing #root{top:68px!important;height:calc(100% - 68px)!important}
#epc-native-options{display:none!important;height:36px;top:32px;gap:14px;background:#fafbfc;padding:0 16px;border-color:var(--ph-line)}body.epc-native-layout.epc-tool-editing #epc-native-options{display:flex!important}
#epc-native-options input,#epc-native-options select{height:26px!important}#epc-native-options label{gap:7px;min-height:26px;font-size:11px!important}
#epc-native-options [data-role=mode]{display:none}#epc-native-options>span:first-child{font-weight:600;padding-right:12px;border-right:1px solid var(--ph-line)}
#epc-native-side{top:32px;width:288px;padding:18px 16px;background:#fff;border-color:var(--ph-line);box-shadow:5px 0 16px #16201908}body.epc-tool-editing #epc-native-side{top:68px}
#epc-native-side>[data-ph-panel-header]{position:sticky;top:-18px;z-index:1;background:#fff;padding:0 0 14px;margin:0 0 16px;border-bottom:1px solid var(--ph-line)}
#epc-native-side>[data-ph-panel-header]>span{font-size:13px;font-weight:600}#epc-native-side [data-close]{width:24px;height:24px;min-height:24px;border:0;padding:0;color:#8b9093;font-size:18px!important}
#epc-native-side .epc-tool-group{margin-bottom:22px}#epc-native-side .epc-tool-group>h3{font:600 11px/1.5 "Mont For Anker","Microsoft YaHei UI",sans-serif;color:#92979a;margin:0 0 10px}
#epc-native-side .epc-tool-grid{grid-template-columns:1fr 1fr;gap:4px}#epc-native-side .epc-tool-grid button{display:flex;align-items:center;gap:9px;min-height:36px;border-color:transparent;padding:8px;text-align:left;background:transparent;font-size:11px}
.epc-tool-icon{display:inline-flex;width:18px;height:18px;flex:0 0 18px;align-items:center;justify-content:center}.epc-tool-icon svg{width:18px;height:18px;stroke:#656c70;stroke-width:1.6;fill:none;stroke-linecap:round;stroke-linejoin:round}
#epc-native-entry>span{font:inherit!important;display:flex!important;align-items:center;justify-content:center;height:30px}#epc-native-entry svg{width:23px;height:23px;stroke:#73797c;stroke-width:1.5;fill:none}
#epc-local-relief-mode{outline:0}#epc-local-relief-mode:focus-visible{outline:2px solid #33bf5a55;outline-offset:2px}#epc-local-relief-panel{border:0!important;border-top:1px solid var(--ph-line)!important;border-radius:0!important;padding:18px 0 0!important;margin:16px 0 0!important;background:transparent}
#epc-local-relief-panel select{max-width:176px;width:176px}#epc-local-relief-panel [data-progress]{font-size:11px;line-height:1.6;color:#85898c;overflow-wrap:anywhere}
#epc-image-limit{position:relative!important;left:auto!important;bottom:auto!important;width:100%!important;border:0!important;border-radius:0!important;box-shadow:none!important;padding:14px 0!important;display:flex;flex-direction:column;align-items:center;gap:5px;cursor:default}#epc-image-limit[hidden]{display:none!important}#epc-image-limit .epc-limit-icon{display:flex;justify-content:center}#epc-image-limit svg{width:23px;height:23px;stroke:#73797c;stroke-width:1.5;fill:none;stroke-linecap:round;stroke-linejoin:round}#epc-image-limit .menu-item-text{font-size:11px;margin:0;color:#6f767a}#epc-image-limit button[role=switch]{position:relative;width:28px;height:16px;min-height:0;padding:0;border:0;border-radius:10px;background:#33bf5a}#epc-image-limit button[role=switch]>span{position:absolute;top:2px;right:2px;width:12px;height:12px;background:white;border-radius:50%}#epc-image-limit button[role=switch][aria-checked=false]{background:#d6d9db!important}#epc-image-limit button[role=switch][aria-checked=false]>span{right:14px!important}
#epc-composition-panel{padding:16px!important;border-color:var(--ph-line)!important}#epc-composition-panel [role=group]{gap:0!important;padding:3px;background:var(--ph-fill);border-radius:8px}
#epc-composition-panel [data-mode]{border:0!important;background:transparent!important;border-radius:6px;font-size:11px!important}#epc-composition-panel [data-mode][aria-pressed=true]{background:#fff!important;color:#2ca651;box-shadow:0 1px 4px #1620190a}
#epc-ink-control{margin-top:16px!important;padding-top:16px!important;border-color:var(--ph-line)!important}#epc-ink-control [data-channels]{display:grid!important;grid-template-columns:repeat(4,1fr);gap:6px!important}#epc-ink-control [data-channels] label{justify-content:center;gap:7px!important;min-height:30px;border:1px solid var(--ph-line);background:var(--ph-fill);border-radius:7px;font-weight:500!important}#epc-ink-control [data-channels] label:has(input:checked){border-color:#b8eac5;background:#f5fbf6}#epc-ink-control [data-all]{font-size:11px!important;color:#85898c!important;padding:0;min-height:20px}#epc-ink-control [data-note]{font-size:11px!important}#epc-ink-control [data-channels] label{position:relative;gap:6px!important;cursor:pointer}#epc-ink-control [data-channels] label input{position:absolute;width:1px;height:1px;opacity:0}#epc-ink-control [data-channels] label:after{content:"";width:10px;font-size:10px;color:#33bf5a}#epc-ink-control [data-channels] label:has(input:checked):after{content:"✓"}#epc-ink-control [data-channels] label:has(input:disabled){opacity:.45;cursor:default}#epc-ink-control [data-channels] label:focus-within{outline:2px solid #33bf5a55;outline-offset:2px}#epc-ink-control .epc-channel-mark{font-size:12px;font-weight:600}#epc-ink-control [data-ink=C]{color:#219bc2}#epc-ink-control [data-ink=M]{color:#ce4386}#epc-ink-control [data-ink=Y]{color:#b59c1e}#epc-ink-control [data-ink=K]{color:#30363a}
#epc-print-algorithm{font:400 12px/1.5 "Mont For Anker","Microsoft YaHei UI",sans-serif!important}#epc-print-algorithm button{min-height:36px!important;border:0!important;padding:8px 12px!important;color:#333!important}#epc-print-algorithm [data-check]{color:#33bf5a}
.epc-native[role=menu]{border:1px solid var(--ph-line)!important;border-radius:9px!important;padding:5px!important;box-shadow:0 5px 22px #16201912!important}.epc-native [role=menuitem]{border-radius:5px;padding:7px 10px;min-height:30px}
#epc-native-status{font-size:12px!important;border-color:#eceeef;box-shadow:0 4px 20px #1620190d;border-radius:8px;padding:9px 14px;max-width:500px}
`;
const paths={wand:'m5 19 10-10m-2-2 4 4M5 3v4M3 5h4m11 9v4m-2-2h4M10 2v2',
 'select-rect':'M4 4h16v16H4z','select-ellipse':'M20 12a8 6 0 1 1-16 0 8 6 0 1 1 16 0',
 lasso:'M9 18c-5-1-7-5-4-9 3-5 14-4 15 2 1 4-7 9-11 5-2-2 0-4 2-3 4 1 3 7-1 8',
 brush:'m14 5 5 5m-9 5L20 5l-2-2L8 13m2 2c-1 5-5 5-7 5 2-2 0-5 5-7z',
 eraser:'m5 17-2-2 11-11 6 6-11 11H5l-2-2m7-10 6 6M9 21h12',
 eyedropper:'m14 4 6 6m-3-7 4 4-3 3-2-2-10 10-3 1 1-3L14 6l-1-1z',
 fill:'m4 11 8-8 8 8-8 8zm0 0h16m-12-9 5 5m6 7c0 0-3 4-3 5a3 3 0 0 0 6 0c0-1-3-5-3-5',
 clone:'M5 19h14v3H5zM8 16v-4h2V8a3 3 0 1 1 4 0v4h2v4z',
 heal:'m5 10 5-5a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6-6zm3-3 9 9m-6-6h.1m2 2h.1',
 gradient:'M4 4h16v16H4zm4 0v16m4-16v16m4-16v16',
 'adjust-form':'M4 7h16M4 17h16M8 4v6m8 4v6',
 'contour-new':'M4 18 9 5l11 7-7 8zM7 3h4v4H7zm11 7h4v4h-4zM2 16h4v4H2z',
 'contour-edit':'M4 19 8 6l12 9-7 5m-7-2 3-10 9 7M6 4h4v4H6zm12 9h4v4h-4z',
 'contour-form':'M5 5h4M5 5v4m14-4h-4m4 0v4M5 19h4m-4 0v-4m14 4h-4m4 0v-4M8 12l3-4 5 3-2 5-5-1z',
 rect:'M4 5h16v14H4z',ellipse:'M20 12a8 7 0 1 1-16 0 8 7 0 1 1 16 0',
 simplify:'M3 18 9 7l6 8 6-12M7 5h4v4H7zm6 8h4v4h-4z',smooth:'M3 18c4-1 4-12 9-12s4 11 9 12',
 'delete-node':'M4 12h16',entry:'M5 17 16 6l3 3L8 20H4zm9-13 3-3 5 5-3 3M4 4h5m-5 0v5'};
function icon(id){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+(paths[id]||paths.entry)+'"/></svg>';}
function install(){let style=document.querySelector('#epc-theme');if(!style){style=document.createElement('style');style.id='epc-theme';document.head.append(style);}style.textContent=css;return style;}
window.EPCTheme={install,icon};
})();
