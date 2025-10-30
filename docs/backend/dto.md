```cs
public class AddUserToSessionRequestDTO
{
    public required string sessionId { get; init; }
    public required string userCode { get; init; }
    public required int agentId { get; set; }
}

public class AIAnswerDTO
{
    public required string answer { get; init; }
    public required bool isRated { get; init; }
    public required string messageID { get; set; }
    public int? rating { get; init; }
    public AIAnswerType answerType { get; init; }
}

public enum AIAnswerType
{
    Text = 0,
    Command = 1,
    DataTable = 2,
    // File,
    Options = 4,
    URL = 5,
    Question = 6,
    ErrorText = 7,
    ServerTask = 8,
    Empty = 9
}

public class AIPublicChatStartDTO
{
    public UserDTO user { get; set; }
    public UserDTO agent { get; set; }
}

public class AIQuestionOptionDTO
{
    public required string Column { get; init; }
    public required string OrginalValue { get; init; }
    public required string SelectedValue { get; init; }
}

public class AiQuestionRequestDTO
{
    // külső paraméterek
    public required string userCode { get; init; }
    public required string sessionId { get; init; }
    public required int agentId { get; init; }
    public required List<string> members { get; init; }
    // AI Question paraméterek
    public required string question { get; init; }
    public required string group { get; init; }
    public required AIQuestionType pquestionType { get; init; }
    public List<AIQuestionOptionDTO> options { get; init; } = new List<AIQuestionOptionDTO>();
}

public class AiQuestionResponseDTO
{
    public required int type { get; init; }
    public required string question { get; init; }
    public required string group { get; init; }
    public List<AIQuestionOptionDTO> options { get; init; } = new List<AIQuestionOptionDTO>();
}

public enum AIQuestionType
{
    Text,
    Options
}

public class AISessionDTO
{
    public required string SessionId { get; init; }
    public required string SessionName { get; init; }
    public required string UserCode { get; init; }
    public required DateTime InsertDate { get; init; }
    public List<AISessionMessageDTO>? Messages { get; set; }
    public required int AgentId { get; set; }
    public required string AgentImage { get; set; }
    public required string AgentDarkImage { get; set; }
    public required List<string> Members { get; set; }
}

public class AISessionMessageDTO
{
    public required DateTime sendDate { get; init; }
    public required string messageID { get; init; }
    public  AIAnswerType messageType { get; init; }
    public required string messageText { get; init; }
    public required string senderUserCode { get; init; }
    public required string senderName { get; init; }
    public required bool isRated { get; init; }
    public int? rating { get; init; }
    public List<string> readByUsers { get; set; }
    public string sessionId { get; set; } 
}

public class AIWelcomeMessageDTO
{
    public required string message { get; init; }
}

public class DeleteSessionByIdrequestDTO
{
    public required string sessionId { get; init; }
    public required int agentId { get; init; }
}

public class GetMessageRequestDTO
{
    public required string messageId { get; set; }
    public required int agentId { get; set; }
}

public class GetSessionByIdRequestDTO
{
    public required string sessionId { get; init; }
    public required int agentId { get; init; }
}

public class GetSessionHeadersByUserIdRequestDTO
{
    public required string userCode { get; init; }
    public required List<string> agents { get; init; }
    public required string filterText { get; init; }
}

public class GetSessionUnreadMessagesRequestDTO
{
    public required string userEmail { get; init; }
    public required string sessionId { get; init; }
    public required int agentId { get; init; }        
}

public class GetUnreadMessagesDTO
{
    public required string sessionId { get; init; }
    public required int unreadMessageCount { get; init; }
}

public class GetUnreadMessagesRequestDTO
{
    public required string userCode { get; init; }
}

public class LogInfoDTO
{
    public string source { get; init; }
    public string title { get; init; }
    public string description { get; init; }
    public LogLevel loglevel { get; init; }
    public string user { get; init; }
    public string details { get; init; }
}

public class LoginRequestDTO
{
  public required string Email {get; init;}
  public required string Password {get; init;}
  public required AuthenticationMode Mode {get; init;}
}

public class LoginResponseDTO
{
    public  string? AccessToken { get; init; }
    public string? RefreshToken { get; init; }
    public InnoChat.Infrastructure.Persistence.Entities.UserDTO? User { get; init; }
}

public class NotifyDto
{
    public string SessionId { get; set; } = string.Empty;
    public string AgentId { get; set; } = string.Empty;
}

public class ReactDTO
{
    public string sessionId { get; set; }
    public string messageId { get; set; }
    public int agentId { get; set; }
}

public class SessionHeaderDTO
{
    public string sessionID { get; init; } = "";
    public string sessionName { get; init; } = "";
    public DateTime insertDate { get; set; }
    public List<int> members { get; set; }
}

public class SessionObjectDTO
{
    public string sessionID { get; init; } = "";
    public string sessionName { get; init; } = "";
    public string messageID { get; init; } = "";
    public int senderUser { get; init; }
    public required DateTime sendDate { get; init; }
    public required bool isCorrect { get; init; }
    public required AIAnswerType messageType { get; init; }
    public string messageText { get; init; } = "";
    public List<int> members { get; set; }
    public List<int> readByUsers { get; set; }
}

public class SetSessionMessageRatingRequestDTO
{
    public required string sessionId { get; init; }
    public required string messageId { get; init; }
    public required bool rating { get; init; }
    public required int agentId { get; init; }
}

public class SetSessionMessagesUnreadRequestDTO
{
    public string sessionID { get; init; } = "";
    public int agent { get; init; }
    public string userCode { get; init; } = "";
}

public class SetSessionNameRequestDTO
{
    public required string sessionId { get; init; }
    public required string sessionName { get; init; }
    public required int agentId { get; init; }
}

public class StartPublicChatrequestDTO
{
    public string userEmail { get; set; }
    public int agentId { get; set; }
}

internal class UserDTOAgent
{
    public int id { get; set; }
    public string name { get; set; } = null!;
    public string email { get; set; } = null!;
    public string? password_hash { get; set; }
    public UserStatus user_status { get; set; }
    public bool invitation_accepted { get; set; }
    public string[] roles { get; set; } = [];
    public bool is_virtual { get; set; }
    public string url { get; set; } = null!;
    public string image { get; set; } = null!;
    public string dark_image { get; set; } = null!;
    public List<int> user_ids { get; set; } = [];
}

```