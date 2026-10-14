// 天体儀・宙の窓の3D用: three.js(ESモジュール版・vendor/ に固定)を読み込み、従来どおりグローバル THREE として公開する。
// インラインの <script type="module"> をやめて外部ファイルにしてあるのは、CSP(script-src 'self')でインラインスクリプトを禁じるため。
import * as THREE from './vendor/three.module.min.js';
window.THREE = THREE;
