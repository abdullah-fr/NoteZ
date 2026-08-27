const BLOCKED_EXAM_TOPIC_PATTERNS = [
  /\b(?:porn|pornography|xxx|hentai|erotic|fetish|bestiality)\b/i,
  /\b(?:nude|nudity|explicit sexual|sexualized|sexually explicit|adult content|adult material)\b/i,
  /\b(?:sexual assault|rape|incest|grooming|child sexual|underage sexual|minor sexual)\b/i,
  /\b(?:suicide|self harm|self-harm|kill myself|end my life)\b/i,
  /\b(?:bomb|explosive|detonator|weapon building|make a weapon|build a weapon)\b/i,
  /\b(?:how to kill|kill someone|murder someone|assassinate|torture someone|mass shooting|graphic violence|gore)\b/i,
  /\b(?:make meth|make fentanyl|make cocaine|make heroin|synthesize poison|manufacture poison)\b/i,
  /\b(?:how to hack|break into an account|steal passwords|credential theft|deploy ransomware|write malware|phishing attack)\b/i,
  /\b(?:terrorist recruitment|extremist propaganda|hate speech)\b/i,
  /\b(?:credit card fraud|identity theft|launder money|evade law enforcement)\b/i,
];

export const EXAM_TOPIC_BLOCK_MESSAGE =
  'This topic is not available for exam generation. Please choose a safe educational topic.';

function normalizeExamInput(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getExamModerationMessage(value: string): string | null {
  const normalized = normalizeExamInput(value);
  return BLOCKED_EXAM_TOPIC_PATTERNS.some(pattern => pattern.test(normalized))
    ? EXAM_TOPIC_BLOCK_MESSAGE
    : null;
}
