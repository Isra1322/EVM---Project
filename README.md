# EVM---Project: Sistema de Gestión de Proyectos TI (Valor Ganado - EVM)

Este repositorio contiene un **Sistema de Gestión de Proyectos de TI** profesional basado en el método del **Valor Ganado (Earned Value Management - EVM)**. El sistema integra el control del cronograma (EDT), el registro del avance y costos reales de manera periódica (Cortes de control), la proyección financiera/temporal del proyecto y la generación visual de la Curva S y evolución de índices mediante gráficos interactivos. Además, incorpora análisis automatizados potenciados por **Inteligencia Artificial (Google Gemini API)** para diagnosticar el estado del proyecto y brindar recomendaciones clave.

---

## 📝 Descripción y Resumen del Sistema

El sistema implementa el estándar de gestión de proyectos del PMI (Project Management Institute) para el control integrado de costo y cronograma usando el método del **Valor Ganado (EVM)**. Sus características clave incluyen:

1. **Gestión de la EDT (Estructura de Desglose de Trabajo):**
   * Registro y secuenciación de tareas con relaciones de precedencia.
   * Validación automática contra dependencias circulares (ciclos) y control de consistencia de la EDT (por ejemplo, validando que exista solo una tarea final sin sucesoras).
   * Cálculo automático de la duración total del proyecto y de la fecha fin estimada mediante un algoritmo de programación temprana (*Early Start* y *Early Finish*).
   * Definición del presupuesto del proyecto mediante la suma del costo planificado de cada tarea, estableciendo el **Presupuesto al Finalizar (BAC - Budget at Completion)**.

2. **Fechas de Corte y Monitoreo del Avance:**
   * Registro periódico de estados de avance para el proyecto (Cortes de Control) donde se ingresa la fecha del corte, el **Valor Ganado (EV - Earned Value)** y el **Costo Real (AC - Actual Cost)**.
   * Cálculo dinámico del **Valor Planificado (PV - Planned Value)** acumulado a la fecha de corte, interpolando los costos diarios planificados a partir de la EDT y su programación temprana.

3. **Cálculo de Índices de Rendimiento e Indicadores EVM:**
   El backend computa en tiempo real métricas clave de salud y proyección del proyecto:
   * **Variaciones:**
     * Variación del Cronograma: $SV = EV - PV$ (indica retraso o adelanto en dinero).
     * Variación del Costo: $CV = EV - AC$ (indica pérdidas o ahorros en dinero).
     * Variación al Finalizar: $VAC = BAC - EAC_{Realista}$ (indica desviación presupuestal proyectada final).
   * **Índices de Rendimiento:**
     * Índice de Rendimiento del Cronograma: $SPI = \frac{EV}{PV}$
     * Índice de Rendimiento del Costo: $CPI = \frac{EV}{AC}$
   * **Proyecciones (Estimados al Finalizar):**
     * Estimación al Finalizar (Realista): $EAC = \frac{BAC}{CPI}$
     * Estimación al Finalizar (Optimista): $EAC_{Optimista} = AC + (BAC - EV)$
     * Estimación al Finalizar (Pesimista): $EAC_{Pesimista} = AC + \frac{BAC - EV}{CPI \times SPI}$
     * Trabajo Restante Estimado: $ETC = EAC - AC$
   * **Índice de Rendimiento para Completar (TCPI):**
     * Con meta en el presupuesto inicial: $TCPI_{BAC} = \frac{BAC - EV}{BAC - AC}$
     * Con meta en el estimado realista: $TCPI_{EAC} = \frac{BAC - EV}{EAC - AC}$

4. **Curva S y Evolución Visual:**
   * Generación y visualización interactiva de la **Curva S** comparando de forma acumulativa y temporal el $PV$, $EV$ y $AC$ a lo largo de la vida del proyecto.
   * Gráfico de **Evolución SPI / CPI** para visualizar tendencias de rendimiento histórico.
   * Gráfico de distribución de costos porcentuales por tarea en la EDT.

5. **Análisis Inteligente (Gemini IA):**
   * Módulo integrado de infraestructura que consume la API de Gemini (`gemini-2.5-flash-lite` o similar) para procesar los indicadores EVM y emitir diagnósticos estructurados, detección de desviaciones críticas y planes de acción accionables.

---

## 🛠️ Tecnologías Usadas

El sistema está diseñado bajo una arquitectura desacoplada y moderna:

* **Backend (API y Lógica de Negocio):**
  * **C# / .NET 8** estructurado bajo los principios de **Clean Architecture** (Arquitectura Limpia).
  * **Entity Framework Core (EF Core)** como ORM para la capa de acceso a datos.
  * **ASP.NET Core Web API** expone los controladores REST para el consumo del cliente.
  * **HttpClient** para la integración con la API de Google Gemini.

* **Base de Datos:**
  * **Microsoft SQL Server** para almacenar de forma relacional proyectos, tareas EDT e históricos de cortes.

* **Frontend (Interfaz de Usuario):**
  * **HTML5, CSS3** (Vanilla CSS de alto rendimiento con variables CSS y soporte de responsive design).
  * **JavaScript (Vanilla - ES6)** para interacciones dinámicas del DOM, manejo de modales, alertas Toast y peticiones HTTP fetch hacia la API REST.
  * **Chart.js** y su plugin de anotaciones para renderizar la Curva S y gráficos estadísticos.

---

## 🚀 Cómo Ejecutar el Sistema

### 1. Requisitos Previos
* Tener instalado [.NET SDK 8.0](https://dotnet.microsoft.com/download/dotnet/8.0).
* Tener instalado y activo [Microsoft SQL Server](https://www.microsoft.com/sql-server/).
* (Opcional) Una API Key de Google Gemini para habilitar el análisis por Inteligencia Artificial.

### 2. Configurar la Base de Datos
1. Abre el archivo de configuración del backend ubicado en: `src/API/appsettings.json`.
2. Modifica la cadena de conexión bajo `ConnectionStrings.DefaultConnection` según los parámetros de tu servidor local SQL Server:
   ```json
   "ConnectionStrings": {
     "DefaultConnection": "Server=TU_SERVIDOR;Database=EVM_DB;Trusted_Connection=True;TrustServerCertificate=True;"
   }
   ```
3. Si deseas usar el análisis con IA, agrega tu API Key de Gemini en la sección `"Gemini"` de ese mismo archivo:
   ```json
   "Gemini": {
     "ApiKey": "TU_GEMINI_API_KEY",
     "Model": "gemini-2.5-flash-lite",
     "BaseUrl": "https://generativelanguage.googleapis.com/v1beta/models"
   }
   ```

### 3. Levantar la Base de Datos (Migraciones)
Aplica las migraciones del proyecto utilizando la interfaz de comandos de .NET (CLI) desde la raíz del repositorio:
```
dotnet ef database update --project src/Persistence --startup-project src/API
```

### 4. Compilar y Ejecutar el Backend
Desde la raíz del repositorio, ejecuta la API Web:
```
dotnet run --project src/API
```
El servidor web local iniciará y estará disponible en las siguientes URLs configuradas:
* **HTTP:** `http://localhost:5041`
* **HTTPS:** `https://localhost:7011`

*(Nota: Puedes validar que el backend responde ingresando a `http://localhost:5041/api/Proyectos` en el navegador).*

### 5. Abrir el Frontend
La aplicación cliente se comunica directamente con `http://localhost:5041`.
1. Abre el archivo `frontend/index.html` en tu navegador web.
2. Recomendamos servirlo mediante un servidor web estático local (como la extensión *Live Server* en VS Code o usando un comando rápido en Python desde la carpeta `frontend/`: `python -m http.server 8000`).

---

## 📂 Estructura General del Proyecto

La organización del repositorio sigue la siguiente jerarquía física y lógica:

```
EVM---Project/
│
├── EVM.slnx                     # Archivo de solución unificado de Visual Studio (.NET)
├── README.md                    # Documentación del proyecto (este archivo)
│
├── frontend/                    # Capa del Cliente Web (Frontend)
│   ├── index.html               # Vista del Dashboard (Creación, edición y listado de proyectos)
│   ├── app.js                   # Lógica de manipulación del DOM y consumo de la API de Proyectos
│   ├── detalle-proyecto.html     # Vista detallada de los índices EVM, Curva S e informes IA
│   ├── detalle-proyecto.js      # Inicialización y renderizado de gráficos con Chart.js e integración de IA
│   └── styles.css               # Hoja de estilos globales y diseño premium responsivo
│
└── src/                         # Código Fuente del Backend (Arquitectura Limpia en .NET)
    ├── Domain/                  # Entidades de dominio fundamentales (Proyecto, TareaEDT, CorteProyecto)
    ├── Application/             # Servicios de negocio, Interfaces, DTOs y lógica matemática del método EVM
    ├── Infrastructure/          # Conectores externos y servicios externos (Llamada al API de Gemini)
    ├── Persistence/             # Configuración del DbContext, mapeo de tablas (Fluent API) y migraciones de base de datos
    └── API/                     # Capa de entrada HTTP (Controladores REST, inyección de dependencias y Program.cs)
```
