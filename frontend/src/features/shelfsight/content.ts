import {
  Bell,
  Building2,
  Camera,
  ClipboardList,
  CodeXml,
  Cpu,
  EyeOff,
  GitCompareArrows,
  Hand,
  Layers,
  ListChecks,
  Lock,
  MessageCircle,
  ScanBarcode,
  ScanEye,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Target,
  Video,
  type LucideIcon,
} from 'lucide-react'

type IconItem = { icon: LucideIcon; title: string; text: string }

export const NAV_LINKS = [
  { href: '#problema', label: 'Problema' },
  { href: '#camara', label: 'Lo que ve la cámara' },
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#modelos', label: 'Modelos' },
  { href: '#plan', label: 'Plan' },
] as const

export const SOURCES = {
  hackathon: 'https://cerebralvalley.ai/e/meta-ai-developer-hackathon',
  metaModels: 'https://dev.meta.ai/docs/models',
  milenio: 'https://www.milenio.com/negocios/ventas-tiendas-abarrotes-crecen-0-4-pese-crisis-financiera',
} as const

export const PROBLEMS: IconItem[] = [
  {
    icon: ClipboardList,
    title: 'Conteo a mano',
    text: 'El dueño recorre los anaqueles al cerrar y se entera de que algo se acabó cuando un cliente lo pide.',
  },
  {
    icon: ScanBarcode,
    title: 'Ventas sin escanear',
    text: 'Los puntos de venta suponen que cada venta se escanea. Muchas tienditas no tienen escáner, así que el inventario se desvía.',
  },
  {
    icon: Building2,
    title: 'Visión hecha para cadenas',
    text: 'Las tiendas sin cajero usan muchas cámaras en el techo y modelos entrenados por producto. Ese costo no es de tiendita.',
  },
]

export const PIPELINE_STEPS: IconItem[] = [
  { icon: Camera, title: 'Captura', text: 'Una cámara IP, una webcam o un celular viejo apunta al anaquel.' },
  {
    icon: ScanLine,
    title: 'Filtro de movimiento',
    text: 'OpenCV corre en la tienda y abre un evento solo cuando algo entra a una zona del anaquel.',
  },
  {
    icon: Video,
    title: 'Clip del evento',
    text: 'Se guarda un clip corto con un cuadro de antes y otro de después. Las personas se difuminan antes de salir de la tienda.',
  },
  {
    icon: ScanEye,
    title: 'SAM 3.1 cuenta',
    text: 'Con prompts cortos como “botella” o “lata” cuenta piezas antes y después, y sigue la mano para saber si fue entrada o salida.',
  },
  {
    icon: Sparkles,
    title: 'Muse Spark identifica',
    text: 'Recibe el clip, los recortes y el catálogo, y responde en JSON qué producto se movió y cuántas piezas.',
  },
  {
    icon: GitCompareArrows,
    title: 'Conciliación',
    text: 'Una capa de reglas compara las dos señales y decide si el inventario cambia solo o pasa a revisión.',
  },
]

type ModelCard = { icon: LucideIcon; name: string; role: string; points: { icon: LucideIcon; text: string }[] }

export const MODELS: ModelCard[] = [
  {
    icon: ScanEye,
    name: 'SAM 3.1',
    role: 'Cuántos y hacia dónde',
    points: [
      {
        icon: Target,
        text: 'Segmenta y cuenta productos con prompts de texto cortos, sin entrenar un modelo por producto.',
      },
      { icon: Layers, text: 'Sigue la mano y el producto en el clip para distinguir una entrada de una salida.' },
      { icon: EyeOff, text: 'Segmenta a las personas para difuminarlas antes de enviar cualquier cuadro.' },
    ],
  },
  {
    icon: Sparkles,
    name: 'Muse Spark',
    role: 'Qué producto y cuántas piezas',
    points: [
      {
        icon: Video,
        text: 'Entiende imagen y video, y su contexto de 1M de tokens cabe el catálogo completo con fotos.',
      },
      { icon: CodeXml, text: 'Responde en JSON estructurado: acción, producto, cantidad y confianza.' },
      {
        icon: MessageCircle,
        text: 'Arma el catálogo desde fotos y atiende al dueño en español llamando a la API de inventario.',
      },
    ],
  },
]

export const SUPPORT_TOOLS: IconItem[] = [
  {
    icon: CodeXml,
    title: 'Muse Code',
    text: 'Agente de programación para construir el pipeline, la API y el tablero en diez días.',
  },
  {
    icon: Cpu,
    title: 'SAM 3.1 con pesos abiertos',
    text: 'Respaldo en una GPU propia si un límite de la API llega a frenar el demo.',
  },
]

export const OWNER_FEATURES: IconItem[] = [
  { icon: Bell, title: 'Alertas de bajo inventario', text: 'Avisa cuando un producto baja del mínimo que tú eliges.' },
  { icon: ListChecks, title: 'Historial con clips', text: 'Cada entrada y salida queda registrada con su clip corto.' },
  {
    icon: Hand,
    title: 'Revisión con un toque',
    text: 'Cuando los modelos no coinciden, confirmas el producto y la corrección mejora el catálogo.',
  },
  {
    icon: MessageCircle,
    title: 'Pregunta en español',
    text: 'Un asistente con Muse Spark consulta tu inventario y te responde.',
  },
]

/** Datos de ejemplo para la vista previa del celular; no son existencias reales. */
export const SAMPLE_STOCK = [
  { name: 'Refresco cola 600 ml', qty: 4, low: true },
  { name: 'Lata 355 ml', qty: 5, low: false },
  { name: 'Papas 45 g', qty: 16, low: false },
  { name: 'Galletas', qty: 3, low: true },
] as const

export const SAMPLE_MOVES = [
  { time: '14:32', delta: '−2', kind: 'exit', text: 'Refresco cola 600 ml' },
  { time: '13:10', delta: '+12', kind: 'entry', text: 'Papas 45 g, resurtido' },
  { time: '12:47', delta: '?', kind: 'review', text: 'Revisar: lata o refresco' },
] as const

export const PRIVACY: IconItem[] = [
  {
    icon: EyeOff,
    title: 'Personas difuminadas',
    text: 'SAM 3.1 las difumina antes de que un cuadro salga de la tienda.',
  },
  { icon: ShieldCheck, title: 'Sin reconocimiento facial', text: 'La cámara apunta al anaquel y no identifica a nadie.' },
  { icon: Lock, title: 'Clips solo en revisión', text: 'Solo se guardan los clips de eventos que esperan confirmación.' },
]

export const PLAN_DAYS = [
  { short: '26', long: '26 oct' },
  { short: '27', long: '27 oct' },
  { short: '28', long: '28 oct' },
  { short: '29', long: '29 oct' },
  { short: '30', long: '30 oct' },
  { short: '31', long: '31 oct' },
  { short: '1', long: '1 nov' },
  { short: '2', long: '2 nov' },
  { short: '3', long: '3 nov' },
  { short: '4', long: '4 nov' },
] as const

/** `span` usa clases completas para que Tailwind las detecte al compilar. */
export const PLAN_ROWS = [
  { label: 'Captura y clips de eventos', dates: '26–27 oct', span: 'col-span-2 col-start-1', final: false },
  { label: 'Conteo y dirección con SAM 3.1', dates: '28–29 oct', span: 'col-span-2 col-start-3', final: false },
  { label: 'Muse Spark y conciliación', dates: '30–31 oct', span: 'col-span-2 col-start-5', final: false },
  { label: 'Tablero, alertas y asistente', dates: '1–2 nov', span: 'col-span-2 col-start-7', final: false },
  { label: 'Evaluación con 100+ eventos', dates: '3 nov', span: 'col-span-1 col-start-9', final: false },
  { label: 'Video demo y entrega', dates: '4 nov', span: 'col-span-1 col-start-10', final: true },
] as const

export const GOALS = [
  { prefix: '≥ ', value: 95, suffix: '%', text: 'de las interacciones con el anaquel detectadas' },
  {
    prefix: '≥ ',
    value: 90,
    suffix: '%',
    text: 'de los eventos resueltos solos, con producto, dirección y cantidad correctos',
  },
  { prefix: '< ', value: 15, suffix: ' s', text: 'del evento al inventario actualizado' },
  { prefix: '< ', value: 5, suffix: ' min', text: 'para configurar un anaquel de 15 productos' },
] as const
