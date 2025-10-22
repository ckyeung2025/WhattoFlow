namespace PurpleRice.Services
{
    /// <summary>
    /// 欄位名稱標準化工具類
    /// </summary>
    public static class ColumnNameNormalizer
    {
        /// <summary>
        /// 統一的欄位名稱標準化函數
        /// </summary>
        /// <param name="header">原始欄位標題</param>
        /// <returns>標準化的欄位名稱</returns>
        public static string Normalize(string header)
        {
            if (string.IsNullOrWhiteSpace(header))
                return string.Empty;

            return header.Trim()
                .Replace(" ", "_")           // 空格轉下劃線
                .Replace("/", "/")           // 保持斜線
                .Replace("(", "_")           // 左括號轉下劃線
                .Replace(")", "_")           // 右括號轉下劃線
                .Replace("-", "_")           // 連字符轉下劃線
                .Replace("&", "_and_")       // & 轉 _and_
                .Replace("%", "_percent_")    // % 轉 _percent_
                .Replace("+", "_plus_")      // + 轉 _plus_
                .Replace("=", "_equal_")     // = 轉 _equal_
                .Replace("?", "_question_")  // ? 轉 _question_
                .Replace("!", "_exclamation_") // ! 轉 _exclamation_
                .Replace("@", "_at_")        // @ 轉 _at_
                .Replace("#", "_hash_")      // # 轉 _hash_
                .Replace("$", "_dollar_")    // $ 轉 _dollar_
                .Replace("*", "_star_")      // * 轉 _star_
                .Replace("\\", "_backslash_") // \ 轉 _backslash_
                .Replace("|", "_pipe_")      // | 轉 _pipe_
                .Replace(":", "_colon_")     // : 轉 _colon_
                .Replace(";", "_semicolon_") // ; 轉 _semicolon_
                .Replace("\"", "_quote_")    // " 轉 _quote_
                .Replace("'", "_apostrophe_") // ' 轉 _apostrophe_
                .Replace(",", "_comma_")     // , 轉 _comma_
                .Replace(".", "_dot_")       // . 轉 _dot_
                .Replace("<", "_lt_")        // < 轉 _lt_
                .Replace(">", "_gt_")        // > 轉 _gt_
                .Replace("[", "_lbracket_")  // [ 轉 _lbracket_
                .Replace("]", "_rbracket_")  // ] 轉 _rbracket_
                .Replace("{", "_lbrace_")    // { 轉 _lbrace_
                .Replace("}", "_rbrace_")    // } 轉 _rbrace_
                .Replace("~", "_tilde_")     // ~ 轉 _tilde_
                .Replace("`", "_backtick_")  // ` 轉 _backtick_
                .Replace("^", "_caret_")     // ^ 轉 _caret_
                .ToLower();                  // 轉小寫
        }
    }
}
