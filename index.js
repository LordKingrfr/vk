const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

// Conexão com o Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

client.once('ready', () => {
    console.log(`Bot online como ${client.user.tag}`);
});

// 1. Comando/Botão para Teste de 1 Hora
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    // BOTÃO: SOLICITAR TESTE
    if (interaction.customId === 'solicitar_teste') {
        const discordId = interaction.user.id;

        // VERIFICAÇÃO ANTI-FRAUDE (Já usou teste antes?)
        const { data: jaUsou } = await supabase
            .from('licencas')
            .select('id')
            .eq('discord_id', discordId)
            .eq('tipo_acesso', 'teste')
            .single();

        if (jaUsou) {
            return interaction.reply({ content: '❌ Você já utilizou seu período de teste neste computador/conta.', ephemeral: true });
        }

        // Criar Ticket para Aprovação
        const channel = await interaction.guild.channels.create({
            name: `teste-${interaction.user.username}`,
            type: 0, // GuildText
            permissionOverwrites: [
                { id: interaction.guild.id, deny: ['ViewChannel'] },
                { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages'] },
            ],
        });

        const embed = new EmbedBuilder()
            .setTitle('🧪 Solicitação de Teste (1 Hora)')
            .setDescription(`Usuário: <@${discordId}>\nStatus: Aguardando aprovação do Admin.`)
            .setColor('#f1c40f');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`aprovar_teste_${discordId}`).setLabel('✅ Liberar 1h').setStyle(ButtonStyle.Success)
        );

        await channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: `Ticket aberto em <#${channel.id}>`, ephemeral: true });
    }

    // BOTÃO: APROVAR E GERAR KEY (Ação do Admin)
    if (interaction.customId.startsWith('aprovar_teste_')) {
        const targetId = interaction.customId.split('_')[2];
        const keyGerada = `TESTE-${Math.random().toString(36).toUpperCase().substring(2, 10)}`;
        const expiraEm = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // +1 hora

        // Salva no Supabase (HWID fica null até o primeiro uso no programa)
        const { error } = await supabase.from('licencas').insert({
            discord_id: targetId,
            chave_acesso: keyGerada,
            tipo_acesso: 'teste',
            plano_dias: 0,
            status: 'ativo',
            expira_em: expiraEm
        });

        if (!error) {
            await interaction.reply(`✅ Key Gerada: \`${keyGerada}\`\nExpira em: 1 hora.\nO usuário já pode usar no programa.`);
        }
    }

    // BOTÃO: RESETAR HWID
    if (interaction.customId === 'resetar_hwid') {
        // Lógica para dar update na coluna hwid para null
        // Isso permite que o usuário use a mesma key em outra máquina
    }
});

client.login(process.env.DISCORD_TOKEN);