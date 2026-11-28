import UIKit

// The tones on the keyboard's mood bar, in the same order as the app.
// Keep the ids in sync with app/tones.js and backend/netlify/functions/tones.js.
struct Tone {
  let id: String
  let label: String
  let word: String
  let noIt: Bool
  let emoji: String
  let free: Bool
  let a: UIColor
  let b: UIColor

  /// "Say it calmer." / "Say sorry."
  var headline: String { noIt ? "Say \(word)." : "Say it \(word)." }
}

extension UIColor {
  convenience init(hex: String) {
    var v: UInt64 = 0
    Scanner(string: hex.replacingOccurrences(of: "#", with: "")).scanHexInt64(&v)
    self.init(red: CGFloat((v >> 16) & 0xff) / 255, green: CGFloat((v >> 8) & 0xff) / 255, blue: CGFloat(v & 0xff) / 255, alpha: 1)
  }
}

private func t(_ id: String, _ label: String, _ word: String, _ emoji: String, free: Bool = false, noIt: Bool = false, _ a: String, _ b: String) -> Tone {
  Tone(id: id, label: label, word: word, noIt: noIt, emoji: emoji, free: free, a: UIColor(hex: a), b: UIColor(hex: b))
}

let TONES: [Tone] = [
  t("calmer", "Calmer", "calmer", "🧊", free: true, "#3fc8ff", "#6f6bff"),
  t("professional", "Professional", "pro", "💼", free: true, "#9fb4d9", "#4d6bff"),
  t("kinder", "Kinder", "kinder", "💛", "#ffd84d", "#ff9f43"),
  t("firmer", "Firmer", "firmer", "🪨", "#c9c3b6", "#7d7aa8"),
  t("apologetic", "Apologetic", "sorry", "🙏", noIt: true, "#b8a4ff", "#7fd1ff"),
  t("funnier", "Funnier", "funnier", "😂", "#b6ff4d", "#25d9c5"),
  t("confident", "Confident", "bolder", "😎", "#ffb347", "#ff4d8b"),
  t("shorter", "Shorter", "shorter", "✂️", "#e8e8f0", "#8f8fa8"),
  t("flirty", "Flirty", "flirtier", "😏", "#ff7ac6", "#b56bff"),
  t("spicy", "Spicy", "spicier", "🌶️", "#ff3d6e", "#a3195b"),
  t("angrier", "Fired Up", "louder", "🔥", "#ff5a1f", "#ff1f3d"),
  t("passive", "Passive-Aggro", "sweeter", "🙂", "#ffe066", "#ff6b9d"),
  t("pirate", "Pirate", "ahoy matey-er", "🏴‍☠️", "#2bd4a8", "#1b6f8f"),
  t("shakespeare", "Shakespeare", "bard-ier", "🎭", "#ffcf5c", "#8a4dff"),
]

/// What the main app shares with the keyboard through the App Group.
enum Shared {
  static let group = "group.ca.notacult.apps.saytwice"
  static var defaults: UserDefaults? { UserDefaults(suiteName: group) }

  static var userId: String? { defaults?.string(forKey: "userId") }
  static var apiUrl: String? { defaults?.string(forKey: "apiUrl") }
  static var isPro: Bool { defaults?.integer(forKey: "isPro") == 1 }

  /// The tone the bar was last left on (kept by the keyboard itself).
  static var lastTone: String? {
    get { defaults?.string(forKey: "keyboardTone") }
    set { defaults?.set(newValue, forKey: "keyboardTone") }
  }
}
