import { Download, Laptop, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import macZip from '@/assets/island-mac.zip.asset.json';
import macArmZip from '@/assets/island-mac-arm64.zip.asset.json';
import winZip from '@/assets/island-win.zip.asset.json';

export function DownloadSection() {
 return <section className="downloads" id="download" aria-label="Download Island">
  <div className="preferences-heading"><h2>Get the desktop app</h2><span>Free · v2.0 · Works offline</span></div>
  <div className="download-grid">
   <div className="download-card"><span className="dash-label"><Laptop size={13} /> macOS · Apple Silicon</span><h3>Island for Mac</h3><p>For M1, M2, M3 and M4 Macs. Unzip, move Island to Applications, then Control-click → Open the first time.</p><Button asChild><a href={macArmZip.url} download="Island-mac-arm64.zip"><Download /> Download for Mac</a></Button></div>
   <div className="download-card"><span className="dash-label"><Laptop size={13} /> macOS · Intel</span><h3>Island for Mac (Intel)</h3><p>For Intel Macs on macOS 12 Monterey or newer. Unzip, move Island to Applications, then Control-click → Open the first time.</p><Button asChild><a href={macZip.url} download="Island-mac-intel.zip"><Download /> Download for Mac</a></Button></div>
   <div className="download-card"><span className="dash-label"><Monitor size={13} /> Windows 10/11 · 64-bit</span><h3>Island for Windows</h3><p>Unzip anywhere and run Island.exe. If SmartScreen appears, choose More info → Run anyway.</p><Button asChild><a href={winZip.url} download="Island-windows-x64.zip"><Download /> Download for Windows</a></Button></div>
   <div className="download-card"><span className="dash-label">What it really does</span><h3>Real data, real controls</h3><p>Live battery, CPU, memory and uptime. Skip songs and change volume — Spotify or Music on Mac, any player on Windows. The first time on Mac, allow Island under Privacy &amp; Security → Automation.</p></div>
  </div>
 </section>;
}
