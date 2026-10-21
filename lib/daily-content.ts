/* ============================================================
   El mensaje del día — para los dos.
   Escritos para esta etapa: los dos en Barcelona, viéndoos
   cada día, durmiendo juntos y buscando vuestra primera casa.
   Sale uno distinto cada día (y es el del aviso de las 8:00).
   ============================================================ */

export const DAILY_MESSAGES = [
  "Ya no contamos los días para vernos. Ahora contamos los días para tener llaves de la misma puerta.",
  "Dormir juntos ya no es un plan: es lo normal. Y lo normal contigo es lo mejor que tengo.",
  "Tu habitación o la mía da igual. Casa es donde acabamos los dos por la noche.",
  "Cada piso que vemos es un ensayo de la vida que queremos. Ninguno es perfecto, pero todos tienen un 'nosotros' dentro.",
  "Barcelona tiene mar, luz y mil calles. Y aun así, lo que más me gusta de aquí es volver a ti.",
  "Hoy alguien sale cansado del trabajo. Que lo primero que encuentre sea un abrazo.",
  "Pronto habrá un cajón con calcetines de los dos mezclados. Qué cosa más tonta y qué ganas.",
  "Se acabaron las despedidas en aeropuertos. Ahora solo hay 'hasta luego' que duran unas horas.",
  "Lo bonito de vernos cada día es que ya no hace falta que todo sea especial. Basta con que seamos nosotros.",
  "Elegir sofá va a ser nuestra primera gran negociación. Que gane el más cómodo.",
  "Algún día recordaremos estas noches en habitaciones pequeñas como el principio de todo.",
  "Despertarse a tu lado sigue sin cansar.",
  "Nos mudamos de ciudad a la vez. Ahora toca mudarnos a la misma casa.",
  "Hogar no es un piso con buena luz. Es la persona con la que lo buscas.",
  "Una cosa pequeña para hoy: preguntar cómo ha ido el día y escuchar la respuesta entera.",
  "En cada visita a un piso: uno mira la luz, el otro los enchufes, y los dos nos imaginamos dentro.",
  "Barcelona todavía nos sorprende. Que no se nos pase descubrirla juntos, aunque vayamos liados.",
  "Las mejores conversaciones del día siguen siendo las de antes de dormir.",
  "Aún no tenemos casa, pero ya tenemos rutina. Y nuestra rutina me encanta.",
  "Un día firmaremos un contrato de alquiler con los dos nombres. El otro contrato ya lo tenemos firmado.",
  "Hoy toca cuidar al otro un poco más de lo normal. Sin motivo.",
  "Lista para el piso: luz, silencio y una cocina donde quepamos los dos. Si además se oye el mar, mejor.",
  "Lo que antes era una videollamada ahora es girar la cabeza. Que no se nos olvide lo que vale.",
  "Venir a vivir aquí fue valiente. Hacerlo juntos fue lo más bonito.",
  "Las prisas de Barcelona se quedan en la puerta. Dentro, solo nosotros.",
  "Un café juntos antes de que cada uno se vaya a lo suyo también cuenta como cita.",
  "Que el cansancio de la semana no nos quite las ganas de reírnos.",
  "Buscar casa cansa. Pero cada 'este no' nos acerca al 'es este'.",
  "Hoy no hace falta plan. Basta con un paseo hasta el mar y volver.",
  "Los dos trabajando, los dos aprendiendo, los dos aquí. Estamos construyendo algo de verdad.",
  "Que nunca falte un 'buenas noches', aunque sea en la misma almohada.",
  "Lo mejor de vivir cerca: si hoy no ha ido bien, en un rato estamos juntos.",
  "La casa que encontremos será grande o pequeña, pero será la primera. Y la primera no se olvida.",
  "Cuidarse también es repartir: uno cocina, el otro friega. O al revés. Pero juntos.",
  "Ya no nos echamos de menos por la distancia. Ahora nos echamos de menos en una mañana larga.",
  "Hoy toca dar las gracias por algo pequeño que hizo el otro ayer.",
  "La ciudad es nueva, lo nuestro no. Y aun así cada día se siente un poco estrenado.",
  "Cuando tengamos casa, la primera cena será sencilla. Lo importante será la mesa.",
  "No hay prisa por encontrar el piso perfecto. Lo difícil ya lo tenemos: con quién vivirlo.",
  "Entre turnos, trabajo y visitas a pisos, que siempre quede un rato solo para los dos.",
  "Abrazarte después de un día largo arregla más cosas de las que parece.",
  "Nos elegimos también en lo aburrido. Y eso es lo que hace que dure.",
  "La ilusión de un piso nuevo se pasa. La de llegar a casa contigo, no.",
  "Barcelona de noche, tú al lado y ninguna prisa. Eso también es un plan.",
  "Hoy toca decirlo en voz alta: te quiero. Sin más.",
  "Esta etapa no se repite. Que la disfrutemos, aunque a veces cueste.",
  "Elegimos la misma ciudad, la misma vida y pronto la misma llave.",
  "Dormir juntos todas las noches antes era un sueño. Ahora es un martes cualquiera.",
  "Se están moviendo muchas cosas. Que lo que no se mueva sea esto.",
  "El mejor barrio de Barcelona va a ser el que elijamos juntos.",
  "Un día miraremos atrás y diremos: aquí empezó lo nuestro de verdad.",
  "Que el móvil espere. Esta noche, conversación sin pantallas.",
  "Ser equipo es notar cuándo el otro necesita ayuda antes de que la pida.",
  "Ya somos un poco de aquí. Y del otro, del todo.",
  "Cada mañana tiene algo de suerte: empezarla contigo.",
  "Lo que estamos montando no es solo un piso. Es nuestra forma de vivir juntos.",
  "Pronto: dos cepillos de dientes en el mismo vaso. Qué ganas de lo cotidiano.",
  "Hay días de mil cosas. Y luego estás tú, que haces que todas encajen.",
];

export function getDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}

export function getDailyMessage(): string {
  return DAILY_MESSAGES[getDayOfYear() % DAILY_MESSAGES.length];
}
