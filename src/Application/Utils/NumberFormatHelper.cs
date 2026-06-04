using System.Globalization;

namespace Application.Utils;

public static class NumberFormatHelper
{
    /// <summary>
    /// Convierte un número a string sin separadores de miles, usando punto para decimales.
    /// </summary>
    public static string FormatStandard(decimal value)
    {
        return value.ToString("0.00", CultureInfo.InvariantCulture);
    }

    /// <summary>
    /// Convierte un número a string sin separadores de miles, usando punto para decimales.
    /// </summary>
    public static string FormatStandard(double value)
    {
        return value.ToString("0.00", CultureInfo.InvariantCulture);
    }
}
