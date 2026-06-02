using Application.Interfaces;
using Infrastructure.AI;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        services.AddHttpClient<IAIService, GeminiAIService>();

        return services;
    }
}
