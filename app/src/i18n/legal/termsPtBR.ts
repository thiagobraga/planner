import type { TermsOfServiceContent } from '../../types/legal';

export const termsPortugueseBrazil: TermsOfServiceContent = {
  title: 'Termos de Serviço',
  subtitle: 'Termos e condições para uso do Planner',
  lastUpdated: 'Última atualização: 7 de agosto de 2026',
  onThisPage: 'Nesta Página',
  backToPlanner: 'Voltar ao Planner',
  sections: [
    {
      id: 'service-description',
      title: '1. Descrição do Serviço',
      paragraphs: [
        'O Planner é uma aplicação digital de gerenciamento de tarefas, notas, coleções e hábitos inspirada no método Bullet Journal em papel. O Planner oferece acesso via web, sincronização em tempo real entre dispositivos e integrações opcionais via API e Model Context Protocol (MCP).',
      ],
    },
    {
      id: 'user-responsibilities',
      title: '2. Responsabilidades do Usuário',
      paragraphs: [
        'Para utilizar o Planner, você deve criar uma conta com um endereço de e-mail válido e manter suas credenciais de acesso e tokens de API confidenciais.',
      ],
      items: [
        'Fornecer informações cadastrais verdadeiras e manter a segurança da sua senha e tokens de API',
        'Não utilizar o Planner para atividades ilícitas, envio de spam ou coleta automatizada não autorizada',
        'Não tentar interromper, sobrecarregar ou contornar controles de segurança ou limites de requisições do serviço',
      ],
    },
    {
      id: 'account-termination',
      title: '3. Encerramento de Conta',
      paragraphs: [
        'Você pode deixar de usar o Planner a qualquer momento. Você pode exportar uma cópia completa em JSON dos seus dados e excluir permanentemente sua conta em Configurações > Geral > Dados e Privacidade. A exclusão da conta remove imediatamente seu registro de usuário e exclui em cascata todas as tarefas, coleções, hábitos, etiquetas, comentários, lembretes e credenciais.',
        'Reservamo-nos o direito de suspender ou encerrar contas que violem estes Termos ou abusem da infraestrutura do serviço.',
      ],
    },
    {
      id: 'intellectual-property',
      title: '4. Propriedade Intelectual e Seus Dados',
      paragraphs: [
        'Você mantém total propriedade sobre todas as tarefas, notas, coleções, hábitos e demais conteúdos que criar no Planner. Ao usar o serviço, você nos concede apenas o direito limitado de armazenar, processar e transmitir seu conteúdo exclusivamente para fornecer o Planner a você.',
        'O código-fonte da aplicação Planner, o sistema de design e os elementos visuais pertencem aos autores do projeto e são licenciados conforme a licença do repositório.',
      ],
    },
    {
      id: 'limitation-of-liability',
      title: '5. Limitação de Responsabilidade',
      paragraphs: [
        'O Planner é fornecido "no estado em que se encontra" e "conforme disponível", sem garantias de qualquer natureza, expressas ou implícitas.',
        'Na extensão máxima permitida pela legislação aplicável, o Planner e seus mantenedores não serão responsáveis por quaisquer danos indiretos, incidentais, especiais ou consequenciais, ou por perda de dados decorrente do uso do serviço. Recomendamos exportar periodicamente seus dados utilizando a ferramenta integrada de exportação.',
      ],
    },
    {
      id: 'governing-law',
      title: '6. Legislação Aplicável',
      paragraphs: [
        'Estes Termos são regidos pelas leis da República Federativa do Brasil, incluindo a Lei Geral de Proteção de Dados Pessoais (LGPD - Lei nº 13.709/2018) e o Marco Civil da Internet (Lei nº 12.965/2014), sem prejuízo dos direitos obrigatórios de proteção ao consumidor e de dados aplicáveis na sua jurisdição (incluindo o GDPR da União Europeia).',
      ],
    },
    {
      id: 'changes-to-terms',
      title: '7. Alterações nos Termos',
      paragraphs: [
        'Podemos atualizar estes Termos periodicamente para refletir novos recursos ou exigências legais. Quando houver alterações relevantes, atualizaremos a data de "Última atualização" no topo desta página e notificaremos os usuários por e-mail ou aviso no aplicativo.',
      ],
    },
  ],
};
