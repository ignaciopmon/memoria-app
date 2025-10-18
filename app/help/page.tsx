// app/help/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { 
  Brain, ArrowLeft, 
  BookCopy, Folder, Edit, FileInput, Trash2, 
  GraduationCap, /* Repeat, */ Shuffle, // Repeat no se usaba, Shuffle sí
  Sparkles, CalendarCheck, Settings, Palette, Keyboard, Info, 
  GripVertical, Paintbrush, Play // <-- Play añadido aquí
} from "lucide-react"; 
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// Pequeño componente auxiliar para los ítems de la ayuda
const HelpItem = ({ icon: Icon, title, children }: { icon: React.ElementType, title: string, children: React.ReactNode }) => (
  <div className="flex items-start gap-4">
    <Icon className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
    <div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <div className="text-muted-foreground space-y-3">{children}</div>
    </div>
  </div>
);

export default async function HelpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6" />
            <span className="text-xl font-bold">Memoria</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <form action="/auth/signout" method="post">
              <Button variant="ghost" size="sm" type="submit">
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <Button variant="ghost" asChild className="mb-6 text-sm">
            <Link href="/settings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a Ajustes
            </Link>
          </Button>
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-bold mb-2">Guía de Memoria</h1>
            <p className="text-lg text-muted-foreground">
              Todo lo que necesitas saber para potenciar tu aprendizaje.
            </p>
          </div>

          <Card className="shadow-lg">
            <CardContent className="p-6 md:p-8 space-y-8">

              <HelpItem icon={Info} title="¿Qué es la Repetición Espaciada?">
                <p>
                  Es una técnica de aprendizaje súper efectiva. En lugar de estudiar todo de golpe, revisas la información a intervalos de tiempo crecientes. Al principio repasas más a menudo, y a medida que lo vas recordando mejor, los repasos se espacian más.
                </p>
                <p>
                  Memoria automatiza esto por ti. Usa un algoritmo inteligente para mostrarte las tarjetas justo cuando estás a punto de olvidarlas, maximizando así la retención a largo plazo. ¡Estudiar menos, recordar más!
                </p>
              </HelpItem>

              <HelpItem icon={BookCopy} title="Mazos (Decks) y Tarjetas (Cards)">
                 <ul className="list-disc space-y-2 pl-5">
                   <li><strong>Mazos:</strong> Son como cuadernos digitales donde guardas tus tarjetas sobre un tema específico (ej: "Vocabulario Inglés B2", "Historia de España").</li>
                   <li><strong>Tarjetas:</strong> Son tus flashcards. Tienen un "Frente" (pregunta, término) y un "Dorso" (respuesta, definición). ¡Puedes añadir texto e imágenes a ambos lados!</li>
                   <li><strong>Crear:</strong> Usa el botón "New Deck" para mazos o "New Card" dentro de un mazo.</li>
                   <li><strong>Editar Tarjetas:</strong> Dentro de un mazo, haz clic en el icono del lápiz (<Edit className="inline h-4 w-4"/>) en una tarjeta para modificar su texto o imágenes.</li>
                 </ul>
              </HelpItem>

              <HelpItem icon={Folder} title="Organización: Carpetas y Edición">
                 <ul className="list-disc space-y-2 pl-5">
                   <li><strong>Carpetas:</strong> Agrupa mazos relacionados (ej: una carpeta "Idiomas" con mazos de "Inglés" y "Francés"). Créalas desde el Dashboard en Modo Edición.</li>
                   <li><strong>Modo Edición:</strong> En el Dashboard, pulsa el botón "Edit". Esto te permite:
                      <ul className="list-circle space-y-1 pl-5 mt-2">
                          <li>Arrastrar (<GripVertical className="inline h-4 w-4"/>) mazos para moverlos (incluso dentro o fuera de carpetas y para reordenarlos).</li>
                          <li>Editar (<Edit className="inline h-4 w-4"/>) mazos y carpetas (nombre y descripción en mazos).</li>
                          <li>Cambiar el color (<Paintbrush className="inline h-4 w-4"/>) de mazos y carpetas para identificarlos visualmente.</li>
                          <li>Eliminar (<Trash2 className="inline h-4 w-4"/>) mazos o carpetas (se moverán a la Papelera).</li>
                      </ul>
                   </li>
                 </ul>
              </HelpItem>
              
              <HelpItem icon={FileInput} title="Importar Contenido">
                <p>
                  ¿Ya tienes tarjetas en otro formato? ¡Impórtalas fácilmente! Dentro de un mazo, usa el botón "Import" para subir archivos:
                </p>
                 <ul className="list-disc space-y-2 pl-5">
                   <li><strong>CSV:</strong> Archivo de texto separado por comas. Selecciona qué columna es el "Frente" y cuál el "Dorso".</li>
                   <li><strong>XLSX (Excel):</strong> Sube tu hoja de cálculo y elige las columnas correspondientes.</li>
                   <li><strong>TXT:</strong> Archivo de texto plano donde cada línea es una tarjeta, con el frente y el dorso separados por un <kbd>Tab</kbd>.</li>
                 </ul>
              </HelpItem>

              <HelpItem icon={GraduationCap} title="Modos de Estudio">
                 <ul className="list-disc space-y-2 pl-5">
                   <li>
                     <strong>Study (<Play className="inline h-4 w-4"/>):</strong> El corazón de Memoria. Te muestra <span className="font-semibold">sólo las tarjetas que te tocan repasar hoy</span> según el algoritmo de repetición espaciada. Tras ver la respuesta, califícala:
                      <ul className="list-circle space-y-1 pl-5 mt-2">
                          <li><span className="font-semibold text-destructive">Again:</span> No la recordabas. Se reinicia y te la volverá a mostrar pronto.</li>
                          <li><span className="font-semibold text-orange-600">Hard:</span> Te costó recordarla. El intervalo será más corto.</li>
                          <li><span className="font-semibold text-blue-600">Good:</span> La recordaste bien. El intervalo aumenta normally.</li>
                          <li><span className="font-semibold text-green-600">Easy:</span> Te resultó muy fácil. El intervalo aumenta considerablemente.</li>
                      </ul>
                   </li>
                   <li>
                     <strong>Practice:</strong> Repasa <span className="font-semibold">todas las tarjetas</span> de un mazo en el orden que quieras (¡incluso aleatorio <Shuffle className="inline h-4 w-4"/>!). Ideal para un repaso rápido antes de un examen. <span className="italic">Este modo no afecta las fechas de revisión programadas</span>.
                   </li>
                 </ul>
              </HelpItem>
              
               <HelpItem icon={Sparkles} title="Funciones con Inteligencia Artificial (IA)">
                 <p>Memoria utiliza IA para hacer tu estudio más inteligente:</p>
                 <ul className="list-disc space-y-3 pl-5">
                   <li>
                     <strong>Crear Mazo con IA (<Sparkles className="inline h-4 w-4"/> New AI Deck):</strong> Describe el tema, tipo de tarjetas (preguntas, vocabulario...), cantidad, idioma y dificultad, ¡y la IA crea el mazo por ti!
                   </li>
                   <li>
                     <strong>Añadir Tarjetas con IA (<Sparkles className="inline h-4 w-4"/> Add AI Cards):</strong> Dentro de un mazo, pide a la IA que genere más tarjetas sobre un tema específico. La IA analizará las tarjetas existentes para mantener el estilo y <span className="font-semibold">evitar duplicados</span>.
                   </li>
                    <li>
                     <strong>Generar Test con IA (<Sparkles className="inline h-4 w-4"/> Generate Test):</strong> En cada mazo, puedes pedirle a la IA que cree un test tipo quiz (con opciones múltiples) sobre tus tarjetas. Puedes filtrar por tarjetas nuevas, difíciles, etc.
                   </li>
                   <li>
                     <strong>Programación Inteligente (AI Scheduling):</strong> <span className="italic">(Opcional, actívalo en Ajustes)</span> Después de hacer un test generado por IA, permite que la IA analice tus resultados y reprograme automáticamente las tarjetas que fallaste o acertaste con dificultad para que las repases antes. Las tarjetas reprogramadas por IA aparecerán marcadas con una estrella (<Sparkles className="inline h-4 w-4 text-purple-500"/>) en la sección "Upcoming".
                   </li>
                 </ul>
              </HelpItem>

              <HelpItem icon={CalendarCheck} title="Próximos Repasos (Upcoming)">
                <p>
                  Accede a esta sección desde el menú del Dashboard (o el menú desplegable en móvil). Aquí verás una lista de todas las tarjetas programadas para revisión futura, ordenadas por fecha.
                </p>
                 <ul className="list-disc space-y-2 pl-5">
                   <li>Puedes ver de qué mazo es cada tarjeta y cuánto falta para su repaso.</li>
                   <li>Las tarjetas reprogramadas por la IA (<Sparkles className="inline h-4 w-4 text-purple-500"/>) mostrarán una explicación al pasar el ratón por encima.</li>
                   <li>Selecciona tarjetas y usa el botón "Reset" si quieres que vuelvan a ser "nuevas" y aparezcan en tu próxima sesión de estudio.</li>
                 </ul>
              </HelpItem>

              <HelpItem icon={Trash2} title="Papelera (Trash)">
                <p>
                  Cuando eliminas mazos, carpetas o tarjetas, no se borran permanentemente al instante. Van a la Papelera (accesible desde el menú del Dashboard).
                </p>
                 <ul className="list-disc space-y-2 pl-5">
                   <li>Desde la Papelera, puedes <span className="font-semibold">Restaurar</span> los elementos a su lugar original.</li>
                   <li>O puedes <span className="font-semibold text-destructive">Eliminarlos Permanentemente</span> (¡esta acción no se puede deshacer!).</li>
                 </ul>
              </HelpItem>

              <HelpItem icon={Settings} title="Ajustes (Settings)">
                 <p>Personaliza tu experiencia en Memoria:</p>
                 <ul className="list-disc space-y-3 pl-5">
                   <li><strong>Study:</strong> Ajusta los intervalos base (en minutos o días) para las calificaciones "Again", "Hard", "Good", y "Easy". Activa o desactiva la función "AI-Powered Scheduling".</li>
                   <li><strong>Shortcuts (<Keyboard className="inline h-4 w-4"/>):</strong> Cambia las teclas rápidas para calificar tarjetas en el Modo Estudio y otros atajos globales.</li>
                   <li><strong>Appearance (<Palette className="inline h-4 w-4"/>):</strong> Elige tu tema preferido (Claro, Oscuro, Pastel) o deja que siga el de tu sistema.</li>
                 </ul>
              </HelpItem>

            </CardContent>
          </Card>
        </div>
      </main>
       <footer className="py-4 text-center text-xs text-muted-foreground">
         Memoria App - Learn Smarter.
       </footer>
    </div>
  );
}