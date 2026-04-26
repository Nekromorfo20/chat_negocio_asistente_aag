// Importar dependencias
import express from 'express';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

//Cargar express
const app = express();
const PORT = process.env.PORT || 3000;

// Servir frontend (index.html)
app.use("/", express.static("public"));

// Middleware para procesar json y urlencoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Instancia de OpenAI y pasar Api Key
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

let userThreads = {};

// Ruta / endpoint / url
app.post("/api/chatbot", async (req, res) => {

    // Recibir pregunta del usuario
    const { userId, message } = req.body;

    if(!message) return res.status(404).json({ message: "¡Has enviado un mensaje vacio!" });

    try {
        if (!userThreads[userId]) {
            const thread = await openai.beta.threads.create();
            userThreads[userId] = thread.id;
        }

        const threadId = userThreads[userId];

        // Añadir mensaje al hilo del asistente
        await openai.beta.threads.messages.create(threadId, {
            role: "user", content: message
        });

        // Ejecutamos petición al asistente
        const myAssistant = await openai.beta.threads.runs.create(threadId, {
            assistant_id: process.env.OPENAI_ID_ASSISTANT
        });

        // Esperar a que la petición al asistente se complete
        let runStatus = myAssistant;
        let attemps = 0;
        const maxAttemps = 30;

        while(runStatus.status !== "completed" && attemps < maxAttemps) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            runStatus = await openai.beta.threads.runs.retrieve(threadId, myAssistant.id);
            attemps++;
            console.log(`Intento: ${attemps} - Status: ${runStatus.status}`);
        }

        if(runStatus.status !== "completed") {
            throw new Error(`La ejecución del asistente no se ha compleado. Estado final: ${runStatus.status}`);
        }

        // Sacar los mensajes
        const messages = await openai.beta.threads.messages.list(threadId);
        console.log(`Total de mensajes en el hilo: ${messages.data.length}`);

        // Filtrar los mensajes del hilo de ocnversación con la IA
        const assistantMsg = message.data.filter(msg => msg.role === "assistant");
        console.log(`Mensajes del asistente encontrados: ${assistantMsg.length}`);

        // Sacar la respuesta mas reciente
        const reply = assistantMsg
                        .sort((a, b) => b.created_at - a.created_at)[0]
                        .content[0].text.value;
        console.log(`Respuesta del assistente: ${reply}`);

        return res.status(200).json({ reply });
    } catch (error) {
        console.log("Error:", error);
        res.status(500).json({ error: "Error al generar la respuesta" });
    }
});

// Servir el backend
app.listen(PORT, () => {
    console.log(`Servidor ejecutandose en http://localhost:${PORT}`);
});