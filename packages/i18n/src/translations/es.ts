/**
 * Spanish translations
 */

export const es = {
  common: {
    yes: 'Sí',
    no: 'No',
    ok: 'OK',
    cancel: 'Cancelar',
    save: 'Guardar',
    delete: 'Eliminar',
    edit: 'Editar',
    close: 'Cerrar',
    loading: 'Cargando...',
    error: 'Error',
    success: 'Éxito',
    warning: 'Advertencia'
  },
  auth: {
    login: 'Iniciar sesión',
    logout: 'Cerrar sesión',
    register: 'Registrarse',
    email: 'Correo electrónico',
    password: 'Contraseña',
    confirmPassword: 'Confirmar contraseña',
    forgotPassword: '¿Olvidaste tu contraseña?',
    rememberMe: 'Recuérdame',
    loginSuccess: 'Inicio de sesión exitoso',
    loginError: 'Correo o contraseña inválidos',
    registerSuccess: 'Registro exitoso',
    registerError: 'Error en el registro'
  },
  navigation: {
    home: 'Inicio',
    dashboard: 'Panel',
    gameSession: 'Sesión de juego',
    characters: 'Personajes',
    campaigns: 'Campañas',
    settings: 'Configuración',
    profile: 'Perfil',
    help: 'Ayuda'
  },
  game: {
    createCharacter: 'Crear personaje',
    editCharacter: 'Editar personaje',
    characterName: 'Nombre del personaje',
    characterClass: 'Clase',
    characterLevel: 'Nivel',
    hitPoints: 'Puntos de vida',
    armorClass: 'Clase de armadura',
    initiative: 'Iniciativa',
    rollDice: 'Tirar dados',
    endTurn: 'Terminar turno',
    startCombat: 'Iniciar combate',
    endCombat: 'Terminar combate'
  },
  messages: {
    welcome: '¡Bienvenido, {{name}}!',
    itemsCount: 'Tienes {{count}} elemento(s)',
    confirmDelete: '¿Estás seguro de que quieres eliminar {{item}}?',
    saveSuccess: '{{item}} guardado exitosamente',
    saveError: 'Error al guardar {{item}}',
    networkError: 'Error de red. Por favor, inténtalo de nuevo.'
  },
  validation: {
    required: 'Este campo es obligatorio',
    email: 'Por favor ingresa un correo válido',
    minLength: 'Debe tener al menos {{min}} caracteres',
    maxLength: 'No debe tener más de {{max}} caracteres',
    passwordMatch: 'Las contraseñas no coinciden',
    invalidFormat: 'Formato inválido'
  }
};
