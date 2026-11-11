
export async function GET() {
  try {
    const url = process.env.GOOGLE_SCRIPT_URL;

    if (!url) {
      throw new Error("GOOGLE_SCRIPT_URL не настроен");
    }

    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Google API: ${response.status}`);
    }

    const data = await response.json();

    return Response.json(data);
  } catch (error) {
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}
