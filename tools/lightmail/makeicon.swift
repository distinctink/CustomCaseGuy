// Draws a simple envelope icon and writes AppIcon.icns into the given folder.
import Cocoa

let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "."
let tmp = FileManager.default.temporaryDirectory.appendingPathComponent("LightMail.iconset")
try? FileManager.default.removeItem(at: tmp)
try! FileManager.default.createDirectory(at: tmp, withIntermediateDirectories: true)

func render(_ px: Int) -> Data {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: px, pixelsHigh: px,
                               bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                               colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    let s = CGFloat(px)
    let inset = s * 0.1
    let rect = NSRect(x: inset, y: inset, width: s - inset * 2, height: s - inset * 2)
    let bg = NSBezierPath(roundedRect: rect, xRadius: s * 0.18, yRadius: s * 0.18)
    NSGradient(starting: NSColor(calibratedRed: 0.86, green: 0.22, blue: 0.18, alpha: 1),
               ending: NSColor(calibratedRed: 0.70, green: 0.12, blue: 0.12, alpha: 1))!
        .draw(in: bg, angle: -90)
    let cfg = NSImage.SymbolConfiguration(pointSize: s * 0.42, weight: .regular)
        .applying(NSImage.SymbolConfiguration(paletteColors: [.white]))
    if let sym = NSImage(systemSymbolName: "envelope.fill", accessibilityDescription: nil)?
        .withSymbolConfiguration(cfg) {
        let sz = sym.size
        sym.draw(in: NSRect(x: (s - sz.width) / 2, y: (s - sz.height) / 2, width: sz.width, height: sz.height))
    }
    NSGraphicsContext.restoreGraphicsState()
    return rep.representation(using: .png, properties: [:])!
}

for base in [16, 32, 128, 256, 512] {
    try! render(base).write(to: tmp.appendingPathComponent("icon_\(base)x\(base).png"))
    try! render(base * 2).write(to: tmp.appendingPathComponent("icon_\(base)x\(base)@2x.png"))
}
let p = Process()
p.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
p.arguments = ["-c", "icns", tmp.path, "-o", "\(out)/AppIcon.icns"]
try! p.run()
p.waitUntilExit()
exit(p.terminationStatus)
