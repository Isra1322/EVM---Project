using System.Net.Http.Json;
using System.Text.Json;
using Application.DTOs;
using Application.Interfaces;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.AI;

public class GeminiAIService : IAIService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    public GeminiAIService(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _configuration = configuration;
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

        var response = await _httpClient.PostAsJsonAsync(url, request);

        if (!response.IsSuccessStatusCode)
        {
            return "No se pudo generar el analisis con Gemini. Verifique la configuracion del servicio.";
        }

        using var content = await response.Content.ReadFromJsonAsync<JsonDocument>();
        var text = content?
            .RootElement
            .GetProperty("candidates")[0]
            .GetProperty("content")
            .GetProperty("parts")[0]
            .GetProperty("text")
            .GetString();

        return string.IsNullOrWhiteSpace(text)
            ? "Gemini no devolvio contenido para el analisis."
            : text;
    }

    private static string BuildPrompt(IndicadoresEvmDto indicadores, AnalisisEvmDto analisisBase)
    {
        return $"""
        Eres un analista de gestion de proyectos especializado en Valor Ganado (EVM).

        Genera un analisis inteligente del proyecto en espanol.
        No inventes datos que no esten en los indicadores.
        Usa recomendaciones concretas y breves.

        Debes incluir:
        - Diagnostico general del proyecto.
        - Interpretacion de SPI y CPI.
        - Riesgos principales.
        - Que corregir.
        - Como corregirlo.
        - Recomendaciones concretas y breves.

        Datos del proyecto:
        ProyectoId: {indicadores.ProyectoId}
        NombreProyecto: {indicadores.NombreProyecto}
        PV: {indicadores.PV}
        EV: {indicadores.EV}
        AC: {indicadores.AC}
        BAC: {indicadores.BAC}
        SV: {indicadores.SV}
        CV: {indicadores.CV}
        SPI: {indicadores.SPI}
        CPI: {indicadores.CPI}
        EAC: {indicadores.EAC}
        ETC: {indicadores.ETC}
        VAC: {indicadores.VAC}
        TCPI: {indicadores.TCPI}

        Analisis base:
        EstadoCronograma: {analisisBase.EstadoCronograma}
        EstadoCosto: {analisisBase.EstadoCosto}
        NivelRiesgo: {analisisBase.NivelRiesgo}
        Resumen: {analisisBase.Resumen}
        Recomendaciones: {string.Join(" | ", analisisBase.Recomendaciones)}
        """;
    }
}
