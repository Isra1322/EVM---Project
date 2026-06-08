using System.Net.Http.Json;
using System.Net;
using System.Text.Json;
using Application.DTOs;
using Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Infrastructure.AI;

public class GeminiAIService : IAIService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<GeminiAIService> _logger;

    public GeminiAIService(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<GeminiAIService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<string> GenerarAnalisisProyectoAsync(IndicadoresEvmDto indicadores, AnalisisEvmDto analisisBase)
    {
        var apiKey = _configuration["Gemini:ApiKey"];

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return "Falta configurar la API Key de Gemini en Gemini:ApiKey.";
        }

        var model = _configuration["Gemini:Model"] ?? "gemini-1.5-flash";
        var baseUrl = _configuration["Gemini:BaseUrl"] ?? "https://generativelanguage.googleapis.com/v1beta/models";
        var url = $"{baseUrl.TrimEnd('/')}/{model}:generateContent?key={Uri.EscapeDataString(apiKey)}";

        var request = new
        {
            contents = new[]
            {
                new
                {
                    parts = new[]
                    {
                        new { text = BuildPrompt(indicadores, analisisBase) }
                    }
                }
            }
        };

        HttpResponseMessage response;

        try
        {
            response = await _httpClient.PostAsJsonAsync(url, request);
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "Error al llamar a Gemini para el proyecto {ProyectoId}, corte {CorteId}.",
                indicadores.ProyectoId,
                indicadores.CorteId);

            return "No se pudo generar el analisis con Gemini. Detalle tecnico: no fue posible conectar con el servicio.";
        }

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync();

            _logger.LogError(
                "Gemini respondio con error para el proyecto {ProyectoId}, corte {CorteId}. StatusCode: {StatusCode}. Body: {Body}",
                indicadores.ProyectoId,
                indicadores.CorteId,
                (int)response.StatusCode,
                errorBody);

            if (response.StatusCode == HttpStatusCode.TooManyRequests)
            {
                return "Límite temporal de Gemini alcanzado. Intente nuevamente en unos minutos o use otra API Key.";
            }

            return $"No se pudo generar el analisis con Gemini. Detalle tecnico: Gemini respondio HTTP {(int)response.StatusCode}.";
        }

        string? text;

        var responseBody = await response.Content.ReadAsStringAsync();

        try
        {
            using var content = JsonDocument.Parse(responseBody);
            text = content
                .RootElement
                .GetProperty("candidates")[0]
                .GetProperty("content")
                .GetProperty("parts")[0]
                .GetProperty("text")
                .GetString();
        }
        catch (Exception exception)
        {
            _logger.LogError(exception,
                "No se pudo leer la respuesta de Gemini para el proyecto {ProyectoId}, corte {CorteId}. Body: {Body}",
                indicadores.ProyectoId,
                indicadores.CorteId,
                responseBody);

            return "No se pudo generar el analisis con Gemini. Detalle tecnico: la respuesta del servicio no tuvo el formato esperado.";
        }

        return string.IsNullOrWhiteSpace(text)
            ? "Gemini no devolvio contenido para el analisis."
            : text;
    }

    private static string BuildPrompt(IndicadoresEvmDto indicadores, AnalisisEvmDto analisisBase)
    {
        return $"""
        Eres un analista de gestion de proyectos especializado en Valor Ganado (EVM).

        Responde solo en espanol, con texto plano y frases claras.
        No uses Markdown crudo: no uses #, ##, asteriscos, negritas, tablas ni simbolos innecesarios.
        No inventes datos. Usa unicamente los datos entregados.
        No agregues introducciones ni cierres fuera de la estructura solicitada.
        Si un indicador no permite una conclusion exacta, dilo de forma directa sin inventar explicaciones.

        Debes responder exactamente con esta estructura:

        Estado del proyecto: Verde / Amarillo / Rojo

        Diagnostico:
        Texto breve explicando si el proyecto esta bien, en riesgo o mal.

        Interpretacion de indicadores:
        - SPI: explicar si el cronograma esta adelantado, normal o retrasado.
        - CPI: explicar si el costo esta controlado o sobre presupuesto.
        - EAC: explicar si el costo final estimado optimista, realista y pesimista supera o no el BAC.
        - TCPI: explicar que tan exigente es el rendimiento necesario para terminar dentro del BAC y del EAC.

        Desviaciones:
        - Indicar desviaciones positivas y negativas respecto al plan usando SV, CV y VAC cuando aplique.

        Recomendaciones concretas:
        - Dar recomendaciones accionables como agregar recursos, reducir alcance, corregir estimaciones, revisar tareas criticas o controlar costos.

        Para Estado del proyecto usa un solo valor:
        Verde si SPI y CPI son mayores o iguales a 1 y no hay desviaciones negativas relevantes.
        Amarillo si existe retraso o sobrecosto moderado, o si TCPI exige mayor rendimiento.
        Rojo si hay retraso y sobrecosto al mismo tiempo, o si EAC supera claramente el BAC.

        Datos del proyecto:
        ProyectoId: {indicadores.ProyectoId}
        CorteId: {indicadores.CorteId}
        NombreProyecto: {indicadores.NombreProyecto}
        Duracion: {indicadores.Duracion}
        UnidadTiempo: {indicadores.UnidadTiempo}
        FechaInicio: {FormatDate(indicadores.FechaInicio)}
        FechaFin: {FormatDate(indicadores.FechaFin)}
        FechaCorte: {FormatDate(indicadores.FechaCorte)}
        BAC: {indicadores.BAC}
        PV: {indicadores.PV}
        EV: {indicadores.EV}
        AC: {indicadores.AC}
        SV: {indicadores.SV}
        CV: {indicadores.CV}
        SPI: {indicadores.SPI}
        CPI: {indicadores.CPI}
        EAC optimista: {indicadores.EACOptimista}
        EAC realista: {indicadores.EACRealista}
        EAC pesimista: {indicadores.EACPesimista}
        EAC: {indicadores.EAC}
        ETC: {indicadores.ETC}
        VAC: {indicadores.VAC}
        TCPI(BAC): {indicadores.TCPIBAC}
        TCPI(EAC): {indicadores.TCPIEAC}
        TCPI: {indicadores.TCPI}

        Analisis base:
        EstadoCronograma: {analisisBase.EstadoCronograma}
        EstadoCosto: {analisisBase.EstadoCosto}
        NivelRiesgo: {analisisBase.NivelRiesgo}
        Resumen: {analisisBase.Resumen}
        Recomendaciones: {string.Join(" | ", analisisBase.Recomendaciones)}
        """;
    }

    private static string FormatDate(DateTime? value)
    {
        return value.HasValue ? value.Value.ToString("yyyy-MM-dd") : "No disponible";
    }
}
