import UIKit

// The Saytwice keyboard.
//
// Top: one mood bar. Swipe it left or right to pick a mood; the whole keyboard glows in that
// mood's colours. Double-tap the bar and whatever you typed in the text box is rewritten in that mood
// (through the Saytwice server, the same as the app, so Pro, daily limits and top-ups all apply).
// Below it: a normal full typing keyboard, so it works every day without rewriting anything.
//
// Privacy: nothing you type is sent anywhere until you double-tap the mood bar. Then only the text in
// the current text box (or the selected text) is sent, to be rewritten.

private let INK = UIColor(hex: "#07070c")
private let TEXT = UIColor(hex: "#f6f4ff")
private let MUTED = UIColor(hex: "#f6f4ff").withAlphaComponent(0.62)
private let MAX_CHARS = 1000

final class KeyboardViewController: UIInputViewController, UIScrollViewDelegate {

  // MARK: State

  private var toneIndex = 0
  private var tone: Tone { TONES[toneIndex] }
  private var busy = false
  private var lastRewrite: (before: String, after: String)?

  private enum Layer { case letters, numbers, symbols }
  private enum Shift { case off, once, locked }
  private var layer = Layer.letters
  private var shift = Shift.once
  private var lastShiftTap = Date.distantPast
  private var lastSpaceTap = Date.distantPast
  private var deleteTimer: Timer?
  private var deleteRepeatStarter: Timer?

  // MARK: Views

  private let glow = GlowView()
  private let bar = UIView()
  private let barFill = CAGradientLayer()
  private let pages = UIScrollView()
  private var pageViews: [MoodPage] = []
  private let leftHint = UILabel()
  private let rightHint = UILabel()
  private let spinner = UIActivityIndicatorView(style: .medium)
  private let undoButton = UIButton(type: .system)
  private let status = UILabel()
  private var keys: [[KeyButton]] = []
  private var heightConstraint: NSLayoutConstraint?
  private let tapFeedback = UIImpactFeedbackGenerator(style: .light)
  private let moodFeedback = UISelectionFeedbackGenerator()

  private var landscape: Bool { traitCollection.verticalSizeClass == .compact }
  private var barH: CGFloat { landscape ? 38 : 48 }
  private var statusH: CGFloat { landscape ? 14 : 18 }
  private var keyH: CGFloat { landscape ? 32 : 44 }
  private var rowGap: CGFloat { landscape ? 6 : 10 }
  private var totalHeight: CGFloat { 6 + barH + 3 + statusH + 3 + keyH * 4 + rowGap * 3 + 6 }

  // MARK: Lifecycle

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = INK
    view.addSubview(glow)

    if let saved = Shared.lastTone, let i = TONES.firstIndex(where: { $0.id == saved }) { toneIndex = i }

    bar.layer.cornerRadius = 16
    bar.layer.borderWidth = 1
    bar.clipsToBounds = true
    bar.backgroundColor = UIColor.white.withAlphaComponent(0.07)
    barFill.startPoint = CGPoint(x: 0, y: 0.5)
    barFill.endPoint = CGPoint(x: 1, y: 0.5)
    bar.layer.addSublayer(barFill)
    view.addSubview(bar)

    pages.isPagingEnabled = true
    pages.showsHorizontalScrollIndicator = false
    pages.delegate = self
    // Rewriting needs a double tap, so a stray tap never uses up a rewrite.
    let double = UITapGestureRecognizer(target: self, action: #selector(moodTapped))
    double.numberOfTapsRequired = 2
    let single = UITapGestureRecognizer(target: self, action: #selector(moodSingleTapped))
    single.require(toFail: double)
    pages.addGestureRecognizer(double)
    pages.addGestureRecognizer(single)
    bar.addSubview(pages)
    for t in TONES {
      let p = MoodPage(tone: t)
      pageViews.append(p)
      pages.addSubview(p)
    }

    for (label, text) in [(leftHint, "‹"), (rightHint, "›")] {
      label.text = text
      label.textColor = MUTED
      label.font = .systemFont(ofSize: 22, weight: .semibold)
      label.textAlignment = .center
      label.isUserInteractionEnabled = false
      bar.addSubview(label)
    }

    spinner.color = TEXT
    spinner.hidesWhenStopped = true
    bar.addSubview(spinner)

    undoButton.setTitle("↺", for: .normal)
    undoButton.titleLabel?.font = .systemFont(ofSize: 20, weight: .bold)
    undoButton.tintColor = TEXT
    undoButton.backgroundColor = UIColor.white.withAlphaComponent(0.1)
    undoButton.layer.cornerRadius = 14
    undoButton.isHidden = true
    undoButton.accessibilityLabel = "Undo rewrite"
    undoButton.addTarget(self, action: #selector(undoTapped), for: .touchUpInside)
    view.addSubview(undoButton)

    status.font = .systemFont(ofSize: 11, weight: .semibold)
    status.textColor = MUTED
    status.textAlignment = .center
    status.adjustsFontSizeToFitWidth = true
    status.minimumScaleFactor = 0.75
    view.addSubview(status)

    let h = view.heightAnchor.constraint(equalToConstant: totalHeight)
    h.priority = UILayoutPriority(999)
    h.isActive = true
    heightConstraint = h

    buildKeys()
    applyTone(animated: false)
    showHint()
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    lastRewrite = nil
    undoButton.isHidden = true
    showHint()
    updateAutoShift()
  }

  override func traitCollectionDidChange(_ previous: UITraitCollection?) {
    super.traitCollectionDidChange(previous)
    heightConstraint?.constant = totalHeight
    view.setNeedsLayout()
  }

  override func textDidChange(_ textInput: UITextInput?) {
    super.textDidChange(textInput)
    updateAutoShift()
  }

  // MARK: Layout

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    let W = view.bounds.width
    glow.frame = view.bounds

    let side: CGFloat = 6
    var y: CGFloat = 6
    let undoW: CGFloat = undoButton.isHidden ? 0 : barH + 6
    bar.frame = CGRect(x: side, y: y, width: W - side * 2 - undoW, height: barH)
    undoButton.frame = CGRect(x: W - side - barH, y: y, width: barH, height: barH)
    barFill.frame = bar.bounds
    let hintW: CGFloat = 26
    leftHint.frame = CGRect(x: 0, y: 0, width: hintW, height: barH)
    rightHint.frame = CGRect(x: bar.bounds.width - hintW, y: 0, width: hintW, height: barH)
    spinner.center = CGPoint(x: bar.bounds.width - hintW - 16, y: barH / 2)

    let pageW = bar.bounds.width
    let oldW = pages.frame.width
    pages.frame = bar.bounds
    for (i, p) in pageViews.enumerated() {
      p.frame = CGRect(x: CGFloat(i) * pageW, y: 0, width: pageW, height: barH)
      p.inset = hintW
    }
    pages.contentSize = CGSize(width: pageW * CGFloat(TONES.count), height: barH)
    if oldW != pageW { pages.contentOffset = CGPoint(x: CGFloat(toneIndex) * pageW, y: 0) }

    y += barH + 3
    status.frame = CGRect(x: side + 8, y: y, width: W - side * 2 - 16, height: statusH)
    y += statusH + 3
    layoutKeys(top: y, width: W)
  }

  // MARK: Mood bar

  func scrollViewDidScroll(_ scrollView: UIScrollView) {
    guard scrollView.frame.width > 0 else { return }
    let i = max(0, min(TONES.count - 1, Int((scrollView.contentOffset.x / scrollView.frame.width).rounded())))
    if i != toneIndex {
      toneIndex = i
      moodFeedback.selectionChanged()
      applyTone(animated: true)
    }
  }

  func scrollViewDidEndDecelerating(_ scrollView: UIScrollView) {
    Shared.lastTone = tone.id
  }

  private func applyTone(animated: Bool) {
    let t = tone
    CATransaction.begin()
    CATransaction.setAnimationDuration(animated ? 0.35 : 0)
    glow.set(a: t.a, b: t.b)
    barFill.colors = [t.a.withAlphaComponent(0.30).cgColor, t.b.withAlphaComponent(0.22).cgColor]
    bar.layer.borderColor = t.a.withAlphaComponent(0.55).cgColor
    CATransaction.commit()
    leftHint.alpha = toneIndex == 0 ? 0.2 : 1
    rightHint.alpha = toneIndex == TONES.count - 1 ? 0.2 : 1
    for (i, p) in pageViews.enumerated() { p.locked = !TONES[i].free && !Shared.isPro }
    for k in keys.joined() where k.kind == .returnKey { k.accent = t.a }
    if !busy { showHint() }
  }

  private func showHint() {
    let t = tone
    if !t.free && !Shared.isPro {
      setStatus("\(t.label) is a Pro mood. Unlock it in the Saytwice app.")
    } else {
      setStatus("SWIPE TO CHANGE MOOD  ·  DOUBLE-TAP TO \(t.headline.uppercased().dropLast())")
    }
  }

  private func setStatus(_ text: String, error: Bool = false) {
    status.text = text
    status.textColor = error ? UIColor(hex: "#ffb4a3") : MUTED
  }

  // MARK: Rewrite

  @objc private func moodSingleTapped() {
    guard !busy else { return }
    pageViews[toneIndex].nudge()
    if tone.free || Shared.isPro { setStatus("Double-tap the mood to rewrite your message.") } else { showHint() }
  }

  @objc private func moodTapped() {
    guard !busy else { return }
    let t = tone
    guard hasFullAccess else {
      setStatus("Turn on Allow Full Access: Settings › General › Keyboard › Keyboards › Saytwice", error: true)
      return
    }
    guard let api = Shared.apiUrl, let url = URL(string: api), api.hasPrefix("https") else {
      setStatus("Open the Saytwice app once to finish setting up the keyboard.", error: true)
      return
    }
    if !t.free && !Shared.isPro {
      setStatus("\(t.label) is a Pro mood. Unlock it in the Saytwice app.", error: true)
      pageViews[toneIndex].shake()
      return
    }

    let proxy = textDocumentProxy
    let original: String
    if let selected = proxy.selectedText, !selected.isEmpty {
      original = selected
    } else {
      let before = proxy.documentContextBeforeInput ?? ""
      let after = proxy.documentContextAfterInput ?? ""
      original = before + after
      // Put the cursor at the end, so the whole message can be swapped out when the rewrite comes back.
      if !after.isEmpty { proxy.adjustTextPosition(byCharacterOffset: after.count) }
    }
    let message = original.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !message.isEmpty else {
      setStatus("Type your message first, then double-tap the mood.", error: true)
      return
    }
    guard message.count <= MAX_CHARS else {
      setStatus("Keep it under \(MAX_CHARS) characters.", error: true)
      return
    }

    setBusy(true)
    var req = URLRequest(url: url, timeoutInterval: 25)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    var body: [String: Any] = ["message": message, "tone": t.id]
    if let uid = Shared.userId { body["userId"] = uid }
    req.httpBody = try? JSONSerialization.data(withJSONObject: body)

    URLSession.shared.dataTask(with: req) { [weak self] data, response, error in
      let code = (response as? HTTPURLResponse)?.statusCode ?? 0
      let json = data.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] } ?? [:]
      DispatchQueue.main.async {
        guard let self = self else { return }
        self.setBusy(false)
        if error != nil || code == 0 {
          self.setStatus("No connection. Check your internet and try again.", error: true)
          return
        }
        let msg = json["error"] as? String
        if code == 402 {
          self.setStatus("\(t.label) is a Pro mood. Unlock it in the Saytwice app.", error: true)
          return
        }
        if (json["code"] as? String) == "limit" {
          self.setStatus((msg ?? "You're out of rewrites for today.") + " Top up in the app.", error: true)
          return
        }
        guard (200..<300).contains(code), let text = json["text"] as? String, !text.isEmpty else {
          self.setStatus(msg ?? "Something went wrong. Try again.", error: true)
          return
        }
        if self.swap(original, for: text) {
          self.lastRewrite = (before: original, after: text)
          self.undoButton.isHidden = false
          self.view.setNeedsLayout()
          self.setStatus(self.leftText(json["left"]) ?? "Done. Tap ↺ to undo.")
          UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
      }
    }.resume()
  }

  /// Replaces `old` (which must sit right before the cursor, or be the selection) with `new`.
  @discardableResult
  private func swap(_ old: String, for new: String) -> Bool {
    let proxy = textDocumentProxy
    if let selected = proxy.selectedText, !selected.isEmpty {
      guard selected == old else {
        setStatus("Your text changed while rewriting. Double-tap the mood again.", error: true)
        return false
      }
      proxy.insertText(new)
      return true
    }
    let before = proxy.documentContextBeforeInput ?? ""
    guard before.hasSuffix(old) else {
      setStatus("Your text changed while rewriting. Double-tap the mood again.", error: true)
      return false
    }
    for _ in 0..<old.count { proxy.deleteBackward() }
    proxy.insertText(new)
    return true
  }

  @objc private func undoTapped() {
    guard let last = lastRewrite else { return }
    if swap(last.after, for: last.before) {
      setStatus("Back to what you wrote.")
    }
    clearUndo()
  }

  private func clearUndo() {
    guard lastRewrite != nil else { return }
    lastRewrite = nil
    undoButton.isHidden = true
    view.setNeedsLayout()
  }

  private func leftText(_ value: Any?) -> String? {
    guard let left = value as? [String: Any], let today = left["today"] as? Int else { return nil }
    let credits = left["credits"] as? Int ?? 0
    return "Done · \(today) left today\(credits > 0 ? " + \(credits)" : "")  ·  tap ↺ to undo"
  }

  private func setBusy(_ on: Bool) {
    busy = on
    pages.isScrollEnabled = !on
    pageViews[toneIndex].busy = on
    if on {
      spinner.startAnimating()
      setStatus("Rewriting…")
    } else {
      spinner.stopAnimating()
    }
  }

  // MARK: Keys

  private func rows() -> [[KeyButton.Kind]] {
    func chars(_ s: String) -> [KeyButton.Kind] { s.map { .char(String($0)) } }
    var bottom: [KeyButton.Kind] = [.layer(layer == .letters ? "123" : "ABC")]
    if needsInputModeSwitchKey { bottom.append(.globe) }
    bottom += [.space, .returnKey]
    switch layer {
    case .letters:
      return [chars("qwertyuiop"), chars("asdfghjkl"), [.shift] + chars("zxcvbnm") + [.delete], bottom]
    case .numbers:
      return [chars("1234567890"), chars("-/:;()$&@\""), [.layer("#+=")] + chars(".,?!'") + [.delete], bottom]
    case .symbols:
      return [chars("[]{}#%^*+="), chars("_\\|~<>€£¥•"), [.layer("123")] + chars(".,?!'") + [.delete], bottom]
    }
  }

  private func buildKeys() {
    keys.joined().forEach { $0.removeFromSuperview() }
    keys = rows().map { row in
      row.map { kind in
        let k = KeyButton(kind: kind)
        k.accent = tone.a
        switch kind {
        case .globe:
          k.addTarget(self, action: #selector(handleInputModeList(from:with:)), for: .allTouchEvents)
        case .delete:
          k.addTarget(self, action: #selector(deleteDown), for: .touchDown)
          k.addTarget(self, action: #selector(deleteUp), for: [.touchUpInside, .touchUpOutside, .touchCancel, .touchDragExit])
        default:
          k.addTarget(self, action: #selector(keyTapped(_:)), for: .touchUpInside)
        }
        view.addSubview(k)
        return k
      }
    }
    refreshKeyLabels()
    view.setNeedsLayout()
  }

  private func layoutKeys(top: CGFloat, width W: CGFloat) {
    let pad: CGFloat = 3, gap: CGFloat = 6
    let unit = (W - pad * 2 - gap * 9) / 10
    for (r, row) in keys.enumerated() {
      let y = top + CGFloat(r) * (keyH + rowGap)
      switch r {
      case 0:
        for (i, k) in row.enumerated() { k.frame = CGRect(x: pad + CGFloat(i) * (unit + gap), y: y, width: unit, height: keyH) }
      case 1:
        let n = CGFloat(row.count)
        let w = unit
        var x = (W - (n * w + (n - 1) * gap)) / 2
        for k in row { k.frame = CGRect(x: x, y: y, width: w, height: keyH); x += w + gap }
      case 2:
        let sideW = unit * 1.35
        let middle = row.count - 2
        let midW = (W - pad * 2 - sideW * 2 - gap * CGFloat(middle + 1)) / CGFloat(middle)
        let w = min(midW, layer == .letters ? unit : midW)
        let block = CGFloat(middle) * w + CGFloat(middle - 1) * gap
        row.first?.frame = CGRect(x: pad, y: y, width: sideW, height: keyH)
        row.last?.frame = CGRect(x: W - pad - sideW, y: y, width: sideW, height: keyH)
        var x = (W - block) / 2
        for k in row.dropFirst().dropLast() { k.frame = CGRect(x: x, y: y, width: w, height: keyH); x += w + gap }
      default:
        let small = unit * 1.25, ret = unit * 2.2
        var x = pad
        var fixed: CGFloat = 0
        for k in row { if case .space = k.kind { continue }; fixed += k.kind == .returnKey ? ret : small }
        let spaceW = W - pad * 2 - fixed - gap * CGFloat(row.count - 1)
        for k in row {
          let w: CGFloat
          switch k.kind {
          case .space: w = spaceW
          case .returnKey: w = ret
          default: w = small
          }
          k.frame = CGRect(x: x, y: y, width: w, height: keyH)
          x += w + gap
        }
      }
    }
  }

  private func refreshKeyLabels() {
    let upper = shift != .off
    for k in keys.joined() {
      switch k.kind {
      case .char(let c): k.setTitle(layer == .letters && upper ? c.uppercased() : c)
      case .shift: k.setTitle(shift == .locked ? "⇪" : "⇧"); k.isOn = shift != .off
      case .layer(let s): k.setTitle(s)
      case .globe: k.setTitle("🌐")
      case .delete: k.setTitle("⌫")
      case .space: k.setTitle("space")
      case .returnKey:
        k.setTitle(returnLabel())
      }
    }
  }

  private func returnLabel() -> String {
    switch textDocumentProxy.returnKeyType ?? .default {
    case .go: return "go"
    case .search, .google, .yahoo: return "search"
    case .send: return "send"
    case .done: return "done"
    case .next: return "next"
    case .join: return "join"
    default: return "return"
    }
  }

  @objc private func keyTapped(_ k: KeyButton) {
    tapFeedback.impactOccurred()
    let proxy = textDocumentProxy
    switch k.kind {
    case .char(let c):
      proxy.insertText(layer == .letters && shift != .off ? c.uppercased() : c)
      clearUndo()
      if shift == .once { shift = .off; refreshKeyLabels() }
      // After typing an apostrophe in 123 mode, jump back to letters like the system keyboard.
      if layer != .letters, c == "'" { layer = .letters; buildKeys() }
    case .space:
      let before = proxy.documentContextBeforeInput ?? ""
      if Date().timeIntervalSince(lastSpaceTap) < 0.35, before.hasSuffix(" "),
         let prev = before.dropLast().last, prev.isLetter || prev.isNumber {
        proxy.deleteBackward()
        proxy.insertText(". ")
        lastSpaceTap = .distantPast
      } else {
        proxy.insertText(" ")
        lastSpaceTap = Date()
      }
      clearUndo()
      if layer != .letters { layer = .letters; buildKeys() }
      updateAutoShift()
    case .returnKey:
      proxy.insertText("\n")
      clearUndo()
      updateAutoShift()
    case .shift:
      let now = Date()
      if now.timeIntervalSince(lastShiftTap) < 0.3 { shift = .locked }
      else { shift = shift == .off ? .once : .off }
      lastShiftTap = now
      refreshKeyLabels()
    case .layer(let s):
      layer = s == "123" ? .numbers : s == "#+=" ? .symbols : .letters
      buildKeys()
    case .delete, .globe:
      break
    }
  }

  @objc private func deleteDown() {
    tapFeedback.impactOccurred()
    textDocumentProxy.deleteBackward()
    clearUndo()
    deleteRepeatStarter = Timer.scheduledTimer(withTimeInterval: 0.4, repeats: false) { [weak self] _ in
      self?.deleteTimer = Timer.scheduledTimer(withTimeInterval: 0.08, repeats: true) { [weak self] _ in
        self?.textDocumentProxy.deleteBackward()
      }
    }
  }

  @objc private func deleteUp() {
    deleteRepeatStarter?.invalidate()
    deleteTimer?.invalidate()
    deleteRepeatStarter = nil
    deleteTimer = nil
    updateAutoShift()
  }

  private func updateAutoShift() {
    guard shift != .locked, layer == .letters else { refreshKeyLabels(); return }
    let proxy = textDocumentProxy
    var next = Shift.off
    switch proxy.autocapitalizationType ?? .sentences {
    case .allCharacters: next = .once
    case .words:
      let before = proxy.documentContextBeforeInput ?? ""
      if before.isEmpty || before.last?.isWhitespace == true { next = .once }
    case .sentences:
      let before = (proxy.documentContextBeforeInput ?? "")
      let trimmed = before.trimmingCharacters(in: .whitespaces)
      if trimmed.isEmpty || before.hasSuffix("\n") ||
          (before.last?.isWhitespace == true && [".", "!", "?"].contains(trimmed.last.map(String.init) ?? "")) {
        next = .once
      }
    default: break
    }
    if next != shift { shift = next }
    refreshKeyLabels()
  }
}

// MARK: - Views

/// The near-black background with the mood's two colours glowing in from opposite corners.
final class GlowView: UIView {
  private let one = CAGradientLayer()
  private let two = CAGradientLayer()

  override init(frame: CGRect) {
    super.init(frame: frame)
    isUserInteractionEnabled = false
    for g in [one, two] { g.type = .radial; layer.addSublayer(g) }
    one.startPoint = CGPoint(x: 0.1, y: 0)
    one.endPoint = CGPoint(x: 0.85, y: 1.1)
    two.startPoint = CGPoint(x: 1, y: 1)
    two.endPoint = CGPoint(x: 0.25, y: 0.1)
  }
  required init?(coder: NSCoder) { fatalError() }

  override func layoutSubviews() {
    super.layoutSubviews()
    one.frame = bounds
    two.frame = bounds
  }

  func set(a: UIColor, b: UIColor) {
    one.colors = [a.withAlphaComponent(0.42).cgColor, a.withAlphaComponent(0).cgColor]
    two.colors = [b.withAlphaComponent(0.36).cgColor, b.withAlphaComponent(0).cgColor]
  }
}

/// One mood on the bar: "🧊  Say it calmer."
final class MoodPage: UIView {
  private let emoji = UILabel()
  private let title = UILabel()
  private let tag = UILabel()
  private let tone: Tone
  var inset: CGFloat = 26 { didSet { setNeedsLayout() } }
  var locked = false { didSet { tag.isHidden = !locked; title.alpha = locked ? 0.6 : 1; setNeedsLayout() } }
  var busy = false { didSet { title.text = busy ? "Rewriting \(tone.label.lowercased())…" : tone.headline; setNeedsLayout() } }

  init(tone: Tone) {
    self.tone = tone
    super.init(frame: .zero)
    isUserInteractionEnabled = false
    emoji.text = tone.emoji
    emoji.font = .systemFont(ofSize: 22)
    title.text = tone.headline
    title.textColor = TEXT
    title.adjustsFontSizeToFitWidth = true
    title.minimumScaleFactor = 0.7
    let base = UIFont.systemFont(ofSize: 18, weight: .heavy)
    title.font = base.fontDescriptor.withDesign(.rounded).map { UIFont(descriptor: $0, size: 18) } ?? base
    tag.text = " PRO 🔒 "
    tag.font = .systemFont(ofSize: 10, weight: .bold)
    tag.textColor = MUTED
    tag.backgroundColor = UIColor.black.withAlphaComponent(0.35)
    tag.layer.cornerRadius = 5
    tag.clipsToBounds = true
    tag.isHidden = true
    [emoji, title, tag].forEach(addSubview)
    isAccessibilityElement = true
    accessibilityLabel = "\(tone.label). Double-tap to rewrite. Swipe for other moods."
  }
  required init?(coder: NSCoder) { fatalError() }

  override func layoutSubviews() {
    super.layoutSubviews()
    let h = bounds.height
    let tagW: CGFloat = tag.isHidden ? 0 : 64
    let maxW = bounds.width - inset * 2 - 40
    let textW = min(title.intrinsicContentSize.width, maxW - 30 - tagW)
    let total = 30 + textW + (tagW > 0 ? tagW + 6 : 0)
    var x = (bounds.width - total) / 2
    emoji.frame = CGRect(x: x, y: 0, width: 30, height: h); x += 30
    title.frame = CGRect(x: x, y: 0, width: textW, height: h); x += textW + 6
    tag.frame = CGRect(x: x, y: (h - 18) / 2, width: tagW, height: 18)
  }

  func nudge() {
    let a = CAKeyframeAnimation(keyPath: "transform.scale")
    a.values = [1, 0.96, 1]
    a.duration = 0.2
    layer.add(a, forKey: "nudge")
  }

  func shake() {
    let a = CAKeyframeAnimation(keyPath: "transform.translation.x")
    a.values = [-8, 8, -5, 5, 0]
    a.duration = 0.3
    layer.add(a, forKey: "shake")
  }
}

/// A frosted-glass key.
final class KeyButton: UIControl {
  enum Kind: Equatable {
    case char(String), shift, delete, layer(String), globe, space, returnKey
  }
  let kind: Kind
  private let label = UILabel()
  var accent: UIColor = .white { didSet { restyle() } }
  var isOn = false { didSet { restyle() } }
  override var isHighlighted: Bool { didSet { restyle() } }

  private var isSpecial: Bool {
    if case .char = kind { return false }
    return kind != .space
  }

  init(kind: Kind) {
    self.kind = kind
    super.init(frame: .zero)
    layer.cornerRadius = 8
    layer.borderWidth = 0.5
    layer.borderColor = UIColor.white.withAlphaComponent(0.14).cgColor
    label.textAlignment = .center
    label.textColor = TEXT
    label.isUserInteractionEnabled = false
    label.adjustsFontSizeToFitWidth = true
    label.minimumScaleFactor = 0.6
    if case .char = kind {
      label.font = .systemFont(ofSize: 22, weight: .regular)
    } else if kind == .shift || kind == .delete {
      label.font = .systemFont(ofSize: 20, weight: .medium)
    } else {
      label.font = .systemFont(ofSize: 15, weight: .medium)
    }
    addSubview(label)
    restyle()
  }
  required init?(coder: NSCoder) { fatalError() }

  func setTitle(_ s: String) {
    label.text = s
    accessibilityLabel = kind == .delete ? "Delete" : kind == .shift ? "Shift" : kind == .globe ? "Next keyboard" : s
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    label.frame = bounds.insetBy(dx: 2, dy: 0)
  }

  private func restyle() {
    if kind == .returnKey {
      backgroundColor = accent.withAlphaComponent(isHighlighted ? 0.55 : 0.35)
    } else if isOn {
      backgroundColor = UIColor.white.withAlphaComponent(isHighlighted ? 0.75 : 0.9)
      label.textColor = INK
      return
    } else {
      let base: CGFloat = isSpecial ? 0.06 : 0.13
      backgroundColor = UIColor.white.withAlphaComponent(isHighlighted ? 0.3 : base)
    }
    label.textColor = TEXT
  }
}
